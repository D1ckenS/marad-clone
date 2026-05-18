import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../services/api_client.dart';
import '../utils/jwt.dart';

const _tokenKey = 'fleetops_access_token';
const _baseUrlKey = 'fleetops_base_url';

class AuthProvider extends ChangeNotifier {
  final ApiClient _client;
  final FlutterSecureStorage _storage;

  String? _token;
  String? _tenantId;
  String? _vesselId;
  String? _email;
  String? _role;

  AuthProvider(this._client, {FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  bool get isAuthenticated => _token != null;
  String? get token => _token;
  String? get tenantId => _tenantId;
  ApiClient get client => _client;
  String? get vesselId => _vesselId;
  String? get email => _email;
  String? get role => _role;
  String get vesselApiUrl => _client.baseUrl;

  /// Called once at app startup to restore a persisted token.
  Future<void> init() async {
    final savedUrl = await _storage.read(key: _baseUrlKey);
    if (savedUrl != null) _client.baseUrl = savedUrl;

    final stored = await _storage.read(key: _tokenKey);
    if (stored != null) _applyToken(stored);
    notifyListeners();
  }

  Future<void> login({
    required String baseUrl,
    required String tenantId,
    required String email,
    required String password,
  }) async {
    _client.baseUrl = baseUrl.isEmpty ? 'http://localhost:3001' : baseUrl;
    final result = await _client.post('/auth/login', {
      'tenantId': tenantId,
      'email': email,
      'password': password,
    }) as Map<String, dynamic>;

    final token = result['access_token'] as String;
    await _storage.write(key: _tokenKey, value: token);
    await _storage.write(key: _baseUrlKey, value: _client.baseUrl);
    _applyToken(token);
    notifyListeners();
  }

  Future<void> logout() async {
    await _storage.delete(key: _tokenKey);
    _token = null;
    _tenantId = null;
    _vesselId = null;
    _email = null;
    _role = null;
    _client.setToken(null);
    notifyListeners();
  }

  void _applyToken(String token) {
    _token = token;
    _client.setToken(token);
    try {
      final payload = decodeJwtPayload(token);
      _tenantId = payload['tenantId'] as String?;
      _vesselId = payload['vesselId'] as String?;
      _email = payload['email'] as String?;
      _role = payload['role'] as String?;
    } catch (_) {
      // Token present but claims undecodable — still authenticated.
    }
  }
}
