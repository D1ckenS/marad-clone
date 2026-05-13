import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:fleetops_mobile/utils/jwt.dart';

/// Builds a fake JWT with the given payload (unsigned — for unit-test use only).
String _fakeJwt(Map<String, dynamic> payload) {
  final header = base64UrlEncode(utf8.encode('{"alg":"HS256","typ":"JWT"}'));
  // Remove padding so the result matches real JWT format
  String encode(String s) => base64UrlEncode(utf8.encode(s)).replaceAll('=', '');
  final body = encode(jsonEncode(payload));
  final headerNoPad = header.replaceAll('=', '');
  return '$headerNoPad.$body.fakesignature';
}

void main() {
  group('decodeJwtPayload', () {
    test('extracts all standard claims', () {
      final token = _fakeJwt({
        'sub': 'user-abc',
        'tenantId': 'tenant-1',
        'vesselId': 'vessel-1',
        'email': 'chief@m/v-test.com',
        'role': 'CHIEF_ENG',
        'type': 'vessel-local',
      });
      final claims = decodeJwtPayload(token);
      expect(claims['sub'], 'user-abc');
      expect(claims['tenantId'], 'tenant-1');
      expect(claims['vesselId'], 'vessel-1');
      expect(claims['email'], 'chief@m/v-test.com');
      expect(claims['role'], 'CHIEF_ENG');
    });

    test('works when vesselId is absent', () {
      final token = _fakeJwt({
        'sub': 'user-shore',
        'tenantId': 'tenant-1',
        'email': 'admin@shore.com',
        'role': 'TENANT_ADMIN',
      });
      final claims = decodeJwtPayload(token);
      expect(claims['vesselId'], isNull);
    });

    test('throws FormatException for a non-JWT string', () {
      expect(() => decodeJwtPayload('not-a-token'), throwsA(isA<FormatException>()));
    });

    test('throws FormatException for a two-part string', () {
      expect(() => decodeJwtPayload('header.payload'), throwsA(isA<FormatException>()));
    });

    test('handles numeric exp and iat claims', () {
      final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      final token = _fakeJwt({
        'sub': 'user-1',
        'tenantId': 't-1',
        'iat': now,
        'exp': now + 3600,
      });
      final claims = decodeJwtPayload(token);
      expect(claims['exp'], greaterThan(now));
    });
  });
}
