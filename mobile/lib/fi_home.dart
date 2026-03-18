import 'dart:convert';
import 'package:ekyc_wallet/constants.dart';
import 'package:ekyc_wallet/login.dart';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class FIHomeScreen extends StatefulWidget {
  const FIHomeScreen({super.key});

  @override
  State<FIHomeScreen> createState() => _FIHomeScreenState();
}

class _FIHomeScreenState extends State<FIHomeScreen> {
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  bool _isSending = false;
  bool _hasScanned = false;

  Future<void> _sendToServer(String qrData) async {
    setState(() => _isSending = true);
    final data = jsonDecode(qrData);

    try {
      final sessionStr = await _secureStorage.read(key: "session");
      final session = jsonDecode(sessionStr!);

      final response = await http.post(
        Uri.parse("${Constants.serverUrl}/fi/verifyUserVC"),
        headers: {
          "Content-Type": "application/json",
          "Cookie":
              "userJWT=${session["token"]}; orgCredentials=${session["orgCredentials"]}",
        },
        body: jsonEncode({
          "userDid": data['did'],
          "vc": data['vc'],
          "proof": data['proof'],
          "publicSignals": data['publicSignals'],
        }),
      );

      if (response.statusCode == 200) {
        _showDialog("✅ Success", "Verification successful!");
      } else {
        _showDialog("❌ Failed", response.body);
      }
    } catch (e) {
      _showDialog("❌ Error", "Network error");
    }

    setState(() => _isSending = false);
  }

  void _showDialog(String title, String message) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              setState(() {
                _hasScanned = false;
              });
            },
            child: const Text("OK"),
          ),
        ],
      ),
    );
  }

  void _openScanner() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => Scaffold(
          appBar: AppBar(title: const Text("Scan QR Code")),
          body: MobileScanner(
            onDetect: (capture) {
              if (_hasScanned) return;

              final barcode = capture.barcodes.first;
              final String? code = barcode.rawValue;

              if (code != null) {
                _hasScanned = true;
                Navigator.pop(context);
                _sendToServer(code);
              }
            },
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        centerTitle: true,
        title: const Text("FI Dashboard"),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await _secureStorage.delete(key: "session");
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              );
            },
          ),
        ],
      ),
      body: Center(
        child: _isSending
            ? const CircularProgressIndicator()
            : ElevatedButton(
                onPressed: _openScanner,
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(220, 55),
                ),
                child: const Text(
                  "Scan QR Code",
                  style: TextStyle(fontSize: 16),
                ),
              ),
      ),
    );
  }
}
