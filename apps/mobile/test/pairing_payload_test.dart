// H15 — Unit tests for `parsePairingPayload`. The parser sits between
// the camera scanner and the login form's text controllers, so every
// failure mode here translates into a UX outcome:
//   * Returns null → scanner stays open with an "Invalid QR" snackbar.
//   * Returns PairingPayload → both fields populate, "Advanced" expands,
//     success snackbar shown.
//
// Stays in lock-step with the web-side `buildPairingPayload` in
// `apps/web-shore/src/pages/MobilePairPage.tsx`.

import 'package:flutter_test/flutter_test.dart';
import 'package:fleetops_mobile/services/pairing_payload.dart';

void main() {
  group('parsePairingPayload', () {
    test('parses a well-formed pairing QR', () {
      final out = parsePairingPayload(
        '{"v":1,"kind":"fleetops-vessel-pairing","baseUrl":"http://192.168.1.5:3001","tenantId":"01ABC"}',
      );
      expect(out, isNotNull);
      expect(out!.baseUrl, 'http://192.168.1.5:3001');
      expect(out.tenantId, '01ABC');
    });

    test('accepts https baseUrl', () {
      final out = parsePairingPayload(
        '{"v":1,"kind":"fleetops-vessel-pairing","baseUrl":"https://vessel.local","tenantId":"01ABC"}',
      );
      expect(out, isNotNull);
      expect(out!.baseUrl, 'https://vessel.local');
    });

    test('trims whitespace inside fields', () {
      final out = parsePairingPayload(
        '{"v":1,"kind":"fleetops-vessel-pairing","baseUrl":"  http://10.0.0.5:3001  ","tenantId":"  01ABC  "}',
      );
      expect(out, isNotNull);
      expect(out!.baseUrl, 'http://10.0.0.5:3001');
      expect(out.tenantId, '01ABC');
    });

    test('returns null for empty input', () {
      expect(parsePairingPayload(''), isNull);
    });

    test('returns null for non-JSON text (e.g. a stray inventory barcode)', () {
      expect(parsePairingPayload('ABC-123'), isNull);
      expect(parsePairingPayload('https://example.com'), isNull);
    });

    test('returns null when kind is wrong', () {
      // Imagine someone scans a different app's pairing JSON.
      final out = parsePairingPayload(
        '{"v":1,"kind":"some-other-app","baseUrl":"http://x","tenantId":"01ABC"}',
      );
      expect(out, isNull);
    });

    test('returns null when v is not 1', () {
      // Future v=2 payloads must not be misinterpreted by older mobile builds.
      final out = parsePairingPayload(
        '{"v":2,"kind":"fleetops-vessel-pairing","baseUrl":"http://x","tenantId":"01ABC"}',
      );
      expect(out, isNull);
    });

    test('returns null when baseUrl is missing', () {
      final out = parsePairingPayload(
        '{"v":1,"kind":"fleetops-vessel-pairing","tenantId":"01ABC"}',
      );
      expect(out, isNull);
    });

    test('returns null when tenantId is missing', () {
      final out = parsePairingPayload(
        '{"v":1,"kind":"fleetops-vessel-pairing","baseUrl":"http://x"}',
      );
      expect(out, isNull);
    });

    test('returns null when baseUrl is empty after trim', () {
      final out = parsePairingPayload(
        '{"v":1,"kind":"fleetops-vessel-pairing","baseUrl":"   ","tenantId":"01ABC"}',
      );
      expect(out, isNull);
    });

    test('returns null when baseUrl scheme is not http(s)', () {
      // Defensive: we don't want ws://, ftp://, javascript:, etc.
      final outFtp = parsePairingPayload(
        '{"v":1,"kind":"fleetops-vessel-pairing","baseUrl":"ftp://vessel","tenantId":"01ABC"}',
      );
      expect(outFtp, isNull);
      final outJs = parsePairingPayload(
        '{"v":1,"kind":"fleetops-vessel-pairing","baseUrl":"javascript:alert(1)","tenantId":"01ABC"}',
      );
      expect(outJs, isNull);
    });

    test('returns null when baseUrl host is empty', () {
      final out = parsePairingPayload(
        '{"v":1,"kind":"fleetops-vessel-pairing","baseUrl":"http://","tenantId":"01ABC"}',
      );
      expect(out, isNull);
    });

    test('returns null when payload is a JSON array (not object)', () {
      expect(parsePairingPayload('[]'), isNull);
      expect(parsePairingPayload('["a","b"]'), isNull);
    });

    test('PairingPayload equality + hashCode', () {
      const a = PairingPayload(baseUrl: 'http://x:3001', tenantId: '01ABC');
      const b = PairingPayload(baseUrl: 'http://x:3001', tenantId: '01ABC');
      const c = PairingPayload(baseUrl: 'http://x:3001', tenantId: '01DEF');
      expect(a, equals(b));
      expect(a.hashCode, b.hashCode);
      expect(a, isNot(equals(c)));
    });
  });
}
