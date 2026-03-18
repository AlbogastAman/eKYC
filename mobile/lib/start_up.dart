import 'dart:convert';
import 'package:ekyc_wallet/fi_home.dart';
import 'package:ekyc_wallet/home.dart';
import 'package:ekyc_wallet/login.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/material.dart';

class AppStartup extends StatefulWidget {
  const AppStartup({super.key});

  @override
  State<AppStartup> createState() => _AppStartupState();
}

class _AppStartupState extends State<AppStartup> {
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();

  @override
  void initState() {
    super.initState();
    _checkSession();
  }

  Future<void> _checkSession() async {
    final sessionString = await _secureStorage.read(key: "session");

    if (sessionString == null) {
      _goToLogin();
      return;
    }

    final session = jsonDecode(sessionString);
    final userType = session["userType"];

    if (userType == 'fi') {
      _goToFIHome();
    } else {
      _goToClientHome();
    }
  }

  void _goToLogin() {
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  void _goToClientHome() {
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => const HomeScreen()),
    );
  }

  void _goToFIHome() {
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => const FIHomeScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
