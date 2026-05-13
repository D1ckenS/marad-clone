import 'dart:convert';

/// Decodes the payload section of a JWT without verifying the signature.
/// Used client-side only to read non-sensitive claims (tenantId, vesselId).
Map<String, dynamic> decodeJwtPayload(String token) {
  final parts = token.split('.');
  if (parts.length != 3) throw const FormatException('Not a JWT');
  final padded = base64Url.normalize(parts[1]);
  final decoded = utf8.decode(base64Url.decode(padded));
  return jsonDecode(decoded) as Map<String, dynamic>;
}
