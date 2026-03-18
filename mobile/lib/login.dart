import 'dart:convert';
import 'package:ekyc_wallet/constants.dart';
import 'package:ekyc_wallet/fi_home.dart';
import 'package:ekyc_wallet/home.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  bool _isLoading = false;
  String _error = "";
  String _selectedUserType = "client";

  void _login() async {
    setState(() {
      _isLoading = true;
      _error = "";
    });

    await Future.delayed(const Duration(seconds: 1)); // simulate API call

    String username = _usernameController.text.trim();
    String password = _passwordController.text.trim();

    try {
      // Locally backend service
      // REPLACE with your actual GCloud VM Public IP
      final response = await http.post(
        Uri.parse('${Constants.serverUrl}/$_selectedUserType/login'),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "login": username,
          "password": password,
          'userType': _selectedUserType,
        }),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);

        final session = _selectedUserType == 'fi'
            ? {
                "token": data["userJWT"],
                "orgCredentials": data["orgCredentials"],
                "userType": _selectedUserType,
              }
            : {
                "token": data["userJWT"],
                "ledgerId": data["ledgerId"],
                "whoRegistered": data["whoRegistered"],
                "userType": _selectedUserType,
              };

        await _secureStorage.write(key: "session", value: jsonEncode(session));

        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => _selectedUserType == 'fi'
                ? const FIHomeScreen()
                : const HomeScreen(),
          ),
        );
      } else {
        setState(() {
          _error = "Invalid username or password";
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = "System error,contact the administrator";
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.lock, size: 80, color: Colors.blue),
              const SizedBox(height: 20),

              const Text(
                "Login",
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),

              const SizedBox(height: 30),

              TextField(
                controller: _usernameController,
                decoration: const InputDecoration(
                  labelText: "Username",
                  border: OutlineInputBorder(),
                ),
              ),

              const SizedBox(height: 15),

              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: "Password",
                  border: OutlineInputBorder(),
                ),
              ),

              const SizedBox(height: 20),

              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Expanded(
                    child: RadioListTile<String>(
                      title: const Text(
                        "Client",
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      value: "client",
                      groupValue: _selectedUserType,
                      onChanged: (value) {
                        setState(() {
                          _selectedUserType = value!;
                        });
                      },
                    ),
                  ),
                  Expanded(
                    child: RadioListTile<String>(
                      title: const Text(
                        "FI",
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      value: "fi",
                      groupValue: _selectedUserType,
                      onChanged: (value) {
                        setState(() {
                          _selectedUserType = value!;
                        });
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              if (_error.isNotEmpty)
                Text(_error, style: const TextStyle(color: Colors.red)),

              const SizedBox(height: 20),
              _isLoading
                  ? const CircularProgressIndicator()
                  : ElevatedButton(
                      onPressed: _login,
                      style: ElevatedButton.styleFrom(
                        minimumSize: const Size(double.infinity, 50),
                      ),
                      child: const Text("Login"),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}
