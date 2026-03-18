import 'dart:convert';
import 'dart:io';
import 'package:ekyc_wallet/constants.dart';
import 'package:ekyc_wallet/login.dart';
import 'package:ekyc_wallet/qr.dart';
import 'package:ekyc_wallet/vc.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'package:shelf_static/shelf_static.dart';
import 'package:jwt_decoder/jwt_decoder.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  WebViewController? _controller;
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  HttpServer? _server;
  bool _isReady = false;
  String _uiStatus = "Starting local server...";
  Map<String, dynamic>? _clientData;
  String? _errorMessage;
  List<Map<String, dynamic>>? _clientRequests;
  List<String>? _approvedFIs;

  dynamic _verifiedVC;
  String? _cookie;

  @override
  void initState() {
    super.initState();
    _initSession().then((_) {
      _startLocalServer();
      if (_cookie != null) {
        _fetchClient();
        _fetchKYCRequests();
        _fetchApprovedFIs();
      }
    });
  }

  Future<void> _initSession() async {
    final sessionString = await _secureStorage.read(key: "session");
    if (sessionString != null) {
      final sessionData = jsonDecode(sessionString);
      _cookie =
          "userJWT=${sessionData["token"]}; ledgerId=${sessionData["ledgerId"]}; whoRegistered=${sessionData["whoRegistered"]}";
    }
  }

  Future<void> _fetchKYCRequests() async {
    try {
      final response = await http.get(
        Uri.parse('${Constants.serverUrl}/client/getClientRequests?status=N'),
        headers: {"Content-Type": "application/json", "Cookie": _cookie!},
      );
      if (response.statusCode == 200) {
        setState(
          () => _clientRequests = List<Map<String, dynamic>>.from(
            jsonDecode(response.body),
          ),
        );
      } else {
        setState(() => _errorMessage = "❌ Rejected: ${response.body}");
      }
    } catch (e) {
      setState(() => _errorMessage = "Network Error: Check Server IP");
    }
  }

  Future<void> _fetchApprovedFIs() async {
    try {
      final response = await http.get(
        Uri.parse('${Constants.serverUrl}/client/getApprovedFis'),
        headers: {"Content-Type": "application/json", "Cookie": _cookie!},
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() => _approvedFIs = List<String>.from(data["approvedFis"]));
      } else {
        setState(() => _errorMessage = "❌ Rejected: ${response.body}");
      }
    } catch (e) {
      setState(() => _errorMessage = "Network Error: Check Server IP");
    }
  }

  Future<void> _fetchClient() async {
    try {
      final response = await http.get(
        Uri.parse('${Constants.serverUrl}/client/getClientData'),
        headers: {"Content-Type": "application/json", "Cookie": _cookie!},
      );
      if (response.statusCode == 200) {
        var data = jsonDecode(response.body);
        if (data['clientData'] == '') {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (_) => LoginScreen()),
          );
        }
        setState(() => _clientData = jsonDecode(response.body));
      } else {
        setState(() => _errorMessage = "❌ Rejected: ${response.body}");
      }
    } catch (e) {
      setState(() => _errorMessage = "Network Error: Check Server IP");
    }
  }

  Future<void> _startLocalServer() async {
    try {
      // 1. Get a physical directory on the device
      final Directory tmpDir = await getTemporaryDirectory();
      final String zkPath = '${tmpDir.path}/zk';
      final Directory zkDir = Directory(zkPath);

      // 2. Create the folder if it doesn't exist
      if (!await zkDir.exists()) {
        await zkDir.create(recursive: true);
      }

      // 3. Copy each asset from the bundle to the physical disk
      final assets = [
        'index.html',
        'snarkjs.min.js',
        'requirements_check.wasm',
        'requirements_check_final.zkey',
      ];

      for (String fileName in assets) {
        final data = await rootBundle.load('assets/zk/$fileName');
        final bytes = data.buffer.asUint8List(
          data.offsetInBytes,
          data.lengthInBytes,
        );
        await File('$zkPath/$fileName').writeAsBytes(bytes);
      }

      // 4. NOW point the handler to the physical path on the device
      final handler = createStaticHandler(
        zkPath,
        defaultDocument: 'index.html',
      );

      _server = await shelf_io.serve(handler, '127.0.0.1', 8080);
      print(
        'Server running at http://127.0.0.1:8080 (Files physically at $zkPath)',
      );

      _initWebView();
    } catch (e) {
      setState(() => _uiStatus = "Server Error: $e");
    }
  }

  void _initWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      ..addJavaScriptChannel(
        'ProofChannel',
        onMessageReceived: (message) {
          final data = jsonDecode(message.message);
          if (data['success'] == true) {
            setState(() {
              _uiStatus = "Generating Proof ... Done";
            });
            data["did"] = _verifiedVC["did"];
            data["vc"] = _verifiedVC["vc"];
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => QRScreen(
                  title: "KYC Proof",
                  data: jsonEncode(data),
                  message: "Present this QR Code to the FI",
                ),
              ),
            );
          } else {
            setState(
              () => _uiStatus =
                  "❌ CRITICAL ERROR: Proof generation failed. Reason: The inputs do not satisfy the circuit constraints (e.g., user is too young).",
            );
          }
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (url) {
            setState(() {
              _isReady = true;
              _uiStatus = "System Ready";
            });
          },
        ),
      )
      // Load from the local server instead of the file system
      ..loadRequest(Uri.parse('http://127.0.0.1:8080/index.html'));
  }

  Future<void> startProofGeneration() async {
    if (_controller == null) return;

    final vcString = await _secureStorage.read(key: "verified_credential");
    if (vcString == null) return;

    final verifiedVC = jsonDecode(vcString);
    setState(() {
      _verifiedVC = verifiedVC;
      _uiStatus = "Generating Proof... (Wait ~10s)";
    });

    // Decode the token to get the payload
    Map<String, dynamic> decodedToken = JwtDecoder.decode(verifiedVC["vc"]);

    final zkProofs = decodedToken['vc']['credentialSubject']['zkProofs'];
    final dob = verifiedVC["rawClaims"]["dateOfBirth"];
    final inputs = {
      // PRIVATE INPUTS - From User's Secure Storage
      "dob": ZKInputConverter.toLiteralBigInt(dob),
      "dobSalt": ZKInputConverter.hexToDecimal(
        verifiedVC["salts"]["dateOfBirth"],
      ),

      "idNum": ZKInputConverter.toAsciiBigInt(
        verifiedVC["rawClaims"]["idNumber"],
      ),
      "idSalt": ZKInputConverter.hexToDecimal(verifiedVC["salts"]["idNumber"]),

      "country": ZKInputConverter.toLiteralBigInt(
        verifiedVC["rawClaims"]["country"],
      ),
      "countrySalt": ZKInputConverter.hexToDecimal(
        verifiedVC["salts"]["country"],
      ),

      // PUBLIC INPUTS (From the Decoded JWT)
      "expectedDobHash": zkProofs['dateOfBirthHash'],
      "expectedIdHash": zkProofs['idNumberHash'],
      "expectedCountryHash": zkProofs['countryHash'],

      // BUSINESS LOGIC
      "thresholdDate": "20080217",
      "requiredCountry": ZKInputConverter.toLiteralBigInt("834"),
    };

    // We pass only the JSON inputs; JS fetches the large files via HTTP
    _controller!.runJavaScript('generateZKProof(${jsonEncode(inputs)})');
  }

  Future<void> _approveRequest(String id, String fid) async {
    if (_cookie == null) return;

    try {
      final response = await http.post(
        Uri.parse('${Constants.serverUrl}/client/approve/$id'),
        headers: {"Content-Type": "application/json", "Cookie": _cookie!},
        body: jsonEncode({"fiId": fid}),
      );

      if (response.statusCode == 200) {
        setState(() => _uiStatus = "Request approved!");
        await _fetchKYCRequests(); // refresh pending requests
      } else {
        setState(() => _uiStatus = "❌ Rejected: ${response.body}");
      }
    } catch (e) {
      setState(() => _uiStatus = "Network Error: Check Server IP");
    }
  }

  @override
  void dispose() {
    _server?.close(); // Shutdown server when app closes
    super.dispose();
  }


  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        centerTitle: true,
        title: const Text("eKYC Prover"),
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
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: SingleChildScrollView(
            physics: BouncingScrollPhysics(),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  _clientData?["clientData"]?["name"] ?? '',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 24),
                ),
                Text(_clientData?["clientData"]["address"] ?? ''),
                // Text(
                //   _clientData?["clientData"]["whoRegistered"]["ledgerUser"] ??
                //       '',
                // ),
                const SizedBox(height: 20),
                const Icon(Icons.verified_user, size: 60, color: Colors.green),
                const SizedBox(height: 20),
                Text(
                  _uiStatus,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 20),
                if (_isReady)
                  Column(
                    children: [
                      ElevatedButton(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const VCScreen()),
                          );
                        },
                        style: ElevatedButton.styleFrom(
                          minimumSize: const Size(200, 50),
                        ),
                        child: const Text(
                          "Verifiable Credential",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      ElevatedButton(
                        onPressed: startProofGeneration,
                        style: ElevatedButton.styleFrom(
                          minimumSize: const Size(200, 50),
                          backgroundColor: Colors.black,
                        ),
                        child: const Text(
                          "Generate Identity Proof",
                          style: TextStyle(color: Colors.white),
                        ),
                      ),
                    ],
                  )
                else
                  const CircularProgressIndicator(),
                const SizedBox(height: 40),
                Text(
                  "Pending Requests",
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 10),
                if (_clientRequests == null)
                  const CircularProgressIndicator() // still loading
                else if (_clientRequests!.isEmpty)
                  const Text("No pending requests")
                else
                  ..._clientRequests!.map((request) {
                    final isApproved = request["approved"] == "Y";
                    return Card(
                      margin: const EdgeInsets.symmetric(vertical: 8),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            // Left side: Request info
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    "FI: ${request["fi"]}",
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    "Created: ${request["createdAt"]}",
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                ],
                              ),
                            ),

                            // Right side: Approve button
                            if (!isApproved)
                              ElevatedButton(
                                onPressed: () {
                                  _approveRequest(
                                    request["_id"],
                                    request["fi"],
                                  );
                                },
                                style: ElevatedButton.styleFrom(
                                  minimumSize: const Size(50, 40),
                                ),
                                child: const Text(
                                  "Approve",
                                  style: TextStyle(color: Colors.green),
                                ),
                              )
                            else
                              const Text(
                                "Approved",
                                style: TextStyle(
                                  color: Colors.green,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                          ],
                        ),
                      ),
                    );
                  }),
                const SizedBox(height: 40),
                Text(
                  "Approved FIs",
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 10),
                if (_approvedFIs == null)
                  const CircularProgressIndicator() // still loading
                else if (_approvedFIs!.isEmpty)
                  const Text("No pending requests")
                else
                  ..._approvedFIs!.map((fi) {
                    return Card(
                      margin: const EdgeInsets.symmetric(vertical: 8),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    fi,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            ElevatedButton(
                              onPressed: () {},
                              style: ElevatedButton.styleFrom(
                                minimumSize: const Size(50, 40),
                                backgroundColor: Colors.red,
                              ),
                              child: const Text(
                                "Remove",
                                style: TextStyle(color: Colors.white),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
              ],
            ),
          ),
        ),
      ),
      // Tiny hidden widget to keep the WebView engine alive
      bottomNavigationBar: SizedBox(
        height: 1,
        child: _controller != null
            ? WebViewWidget(controller: _controller!)
            : const SizedBox(),
      ),
    );
  }
}

class ZKInputConverter {
  /// REPLICATES: numToBigInt
  /// Use for DOB and Country
  static String toLiteralBigInt(dynamic value) {
    if (value == null) return "0";
    // Removes anything not a number (like dashes in dates)
    String clean = value.toString().replaceAll(RegExp(r'\D'), '');
    return BigInt.parse(clean).toString();
  }

  /// REPLICATES: textToBigInt
  /// Use for ID Numbers (e.g., "ALN123")
  static String toAsciiBigInt(String? value) {
    if (value == null || value.isEmpty) return "0";

    // 1. Convert string to UTF-8 bytes
    List<int> bytes = utf8.encode(value);

    // 2. Convert bytes to a Hex string
    String hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();

    // 3. Convert Hex to a Decimal BigInt string
    return BigInt.parse(hex, radix: 16).toString();
  }

  /// Use for Salts (converts Hex salt from storage to Decimal)
  static String hexToDecimal(String hex) {
    // Ensure we handle the "0x" prefix if it exists
    String cleanHex = hex.startsWith('0x') ? hex.substring(2) : hex;
    return BigInt.parse(cleanHex, radix: 16).toString();
  }
}
