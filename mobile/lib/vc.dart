import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class VCScreen extends StatefulWidget {
  const VCScreen({super.key});

  @override
  State<VCScreen> createState() => _VCScreenState();
}

class _VCScreenState extends State<VCScreen> {
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();

  bool _isLoading = true;
  bool _hasCredential = false;

  @override
  void initState() {
    super.initState();
    _checkCredential();
  }

  Future<void> _checkCredential() async {
    final vc = await _secureStorage.read(key: "verified_credential");

    setState(() {
      _hasCredential = vc != null;
      _isLoading = false;
    });
  }

  Future<void> _saveCredential(String rawQrData) async {
    await _secureStorage.write(key: "verified_credential", value: rawQrData);

    setState(() {
      _hasCredential = true;
    });
  }

  Future<void> _deleteCredential() async {
    await _secureStorage.delete(key: "verified_credential");

    setState(() {
      _hasCredential = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(title: const Text("Verified Credential")),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: _hasCredential ? _buildSavedView() : _buildScannerView(),
        ),
      ),
    );
  }

  // =========================
  // SCANNER VIEW
  // =========================
  Widget _buildScannerView() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Text(
          "Scan Verified Credential QR",
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 20),
        SizedBox(
          height: 300,
          child: MobileScanner(
            onDetect: (barcodeCapture) {
              final barcode = barcodeCapture.barcodes.first;
              final raw = barcode.rawValue;
              if (raw != null) {
                _saveCredential(raw);
              }
            },
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          "Align the QR code inside the frame",
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  // =========================
  // SAVED VIEW
  // =========================
  Widget _buildSavedView() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.verified, size: 80, color: Colors.green),
        const SizedBox(height: 20),
        const Text(
          "Verified Credential Saved",
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Colors.green,
          ),
        ),
        const SizedBox(height: 10),
        const Text(
          "Your credential is securely stored and ready for proof generation",
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 30),
        ElevatedButton(
          onPressed: _deleteCredential,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.blue,
            foregroundColor: Colors.white,
          ),
          child: const Text("Recapture Credential"),
        ),
      ],
    );
  }
}
