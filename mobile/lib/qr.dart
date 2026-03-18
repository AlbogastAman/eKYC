import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

class QRScreen extends StatelessWidget {
  final String title;
  final dynamic data;
  final String message;

  const QRScreen({
    super.key,
    required this.title,
    required this.data,
    required this.message,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // 🔹 QR Code
              QrImageView(
                data: data,
                version: QrVersions.auto,
                size: 250.0,
              ),

              const SizedBox(height: 24),
              // 🔹 Message Below QR
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
