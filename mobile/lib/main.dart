import 'package:ekyc_wallet/start_up.dart';
import 'package:flutter/material.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const EKYCApp());
}

class EKYCApp extends StatelessWidget {
  const EKYCApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      debugShowCheckedModeBanner: false,
      home: AppStartup(),
    );
  }
}

