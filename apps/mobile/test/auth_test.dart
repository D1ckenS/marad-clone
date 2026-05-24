import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fleetops_mobile/providers/auth_provider.dart';
import 'package:fleetops_mobile/services/api_client.dart';

/// Test double for [ApiClient] — captures POST body and returns a canned JWT
/// without touching the network.
class _CapturingApiClient extends ApiClient {
  _CapturingApiClient(this._tokenToReturn);

  final String _tokenToReturn;
  String? capturedPath;
  Map<String, dynamic>? capturedBody;

  @override
  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    capturedPath = path;
    capturedBody = body;
    return {'access_token': _tokenToReturn};
  }
}

/// In-memory stub for flutter_secure_storage's platform channel.
/// Avoids MissingPluginException when AuthProvider.login persists the token.
void _installFakeSecureStorage() {
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  final store = <String, String>{};
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(channel, (MethodCall call) async {
    final args = (call.arguments as Map?) ?? const {};
    final key = args['key'] as String?;
    switch (call.method) {
      case 'read':
        return store[key];
      case 'write':
        store[key!] = args['value'] as String;
        return null;
      case 'delete':
        store.remove(key);
        return null;
      case 'readAll':
        return Map<String, String>.from(store);
      case 'deleteAll':
        store.clear();
        return null;
      case 'containsKey':
        return store.containsKey(key);
      default:
        return null;
    }
  });
}

/// Builds an unsigned JWT with the given payload — sufficient for AuthProvider
/// claim decoding which doesn't verify the signature.
String _fakeJwt(Map<String, dynamic> payload) {
  String encode(String s) => base64UrlEncode(utf8.encode(s)).replaceAll('=', '');
  final header = encode('{"alg":"HS256","typ":"JWT"}');
  final body = encode(jsonEncode(payload));
  return '$header.$body.sig';
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(_installFakeSecureStorage);

  group('AuthProvider.login', () {
    test('sends "identifier" field (not "email") to /auth/login', () async {
      final token = _fakeJwt({'sub': 'u1', 'tenantId': 't1', 'email': 'x@y.z'});
      final client = _CapturingApiClient(token);
      final auth = AuthProvider(client);

      await auth.login(
        baseUrl: 'http://vessel.local:3001',
        tenantId: 't1',
        email: 'crew@example.com',
        password: 'Pass1234!',
      );

      expect(client.capturedPath, '/auth/login');
      expect(client.capturedBody, isNotNull);
      // Regression: vessel LoginDto requires `identifier`, not `email`.
      expect(client.capturedBody!.containsKey('identifier'), isTrue,
          reason: 'request body must use "identifier" field');
      expect(client.capturedBody!.containsKey('email'), isFalse,
          reason: 'request body must NOT use legacy "email" field');
      expect(client.capturedBody!['identifier'], 'crew@example.com');
      expect(client.capturedBody!['password'], 'Pass1234!');
      expect(client.capturedBody!['tenantId'], 't1');
    });

    test('falls back to localhost:3001 when baseUrl is empty', () async {
      final token = _fakeJwt({'sub': 'u1', 'tenantId': 't1'});
      final client = _CapturingApiClient(token);
      final auth = AuthProvider(client);

      await auth.login(
        baseUrl: '',
        tenantId: 't1',
        email: 'a@b.c',
        password: 'pw',
      );

      expect(client.baseUrl, 'http://localhost:3001');
    });

    test('marks provider authenticated and decodes claims after login', () async {
      final token = _fakeJwt({
        'sub': 'u1',
        'tenantId': 't1',
        'vesselId': 'v1',
        'email': 'chief@m.v',
        'role': 'CHIEF_ENG',
      });
      final client = _CapturingApiClient(token);
      final auth = AuthProvider(client);

      await auth.login(
        baseUrl: 'http://vessel.local:3001',
        tenantId: 't1',
        email: 'chief@m.v',
        password: 'pw',
      );

      expect(auth.isAuthenticated, isTrue);
      expect(auth.token, token);
      expect(auth.userId, 'u1',
          reason: 'sign-item and other sign-off flows need the JWT sub claim');
      expect(auth.tenantId, 't1');
      expect(auth.vesselId, 'v1');
      expect(auth.email, 'chief@m.v');
      expect(auth.role, 'CHIEF_ENG');
    });
  });
}
