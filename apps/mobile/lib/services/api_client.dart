import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  final int statusCode;
  final String message;
  const ApiException(this.statusCode, this.message);

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class ApiClient {
  String baseUrl;
  String? _token;

  ApiClient({this.baseUrl = 'http://localhost:3001'});

  void setToken(String? token) => _token = token;

  Map<String, String> get _authHeaders => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Future<dynamic> get(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = await http.get(uri, headers: _authHeaders);
    return _handle(response);
  }

  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = await http.post(
      uri,
      headers: _authHeaders,
      body: jsonEncode(body),
    );
    return _handle(response);
  }

  /// Sends a multipart POST. [files] are added under [fileField] (default "photos").
  Future<dynamic> postMultipart(
    String path, {
    required Map<String, String> fields,
    required List<File> files,
    String fileField = 'photos',
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final request = http.MultipartRequest('POST', uri);
    if (_token != null) request.headers['Authorization'] = 'Bearer $_token';
    request.fields.addAll(fields);
    for (final file in files) {
      request.files.add(await http.MultipartFile.fromPath(fileField, file.path));
    }
    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    return _handle(response);
  }

  dynamic _handle(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return null;
      return jsonDecode(response.body);
    }
    String message;
    try {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      message = json['message']?.toString() ?? response.body;
    } catch (_) {
      message = response.body;
    }
    throw ApiException(response.statusCode, message);
  }
}
