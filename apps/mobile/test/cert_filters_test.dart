import 'package:flutter_test/flutter_test.dart';
import 'package:fleetops_mobile/models/certificate.dart';
import 'package:fleetops_mobile/screens/certificates_screen.dart';

Certificate _cert({String? expiresAt, String id = 'c'}) => Certificate(
      id: id,
      expiresAt: expiresAt != null ? DateTime.parse(expiresAt) : null,
    );

void main() {
  // Fixed reference instant so the test is deterministic regardless of wall
  // clock. The vessel certs are filtered client-side now because the vessel
  // /certificates endpoint silently ignores ?expiringWithinDays.
  final now = DateTime.utc(2026, 5, 25);

  group('filterCertsExpiringWithin', () {
    test('keeps certs expiring within the window', () {
      // From 2026-05-25:
      //   '1' = +7 days → in
      //   '2' = +89 days → in (boundary, inclusive)
      //   '3' = +221 days → out
      final input = [
        _cert(id: '1', expiresAt: '2026-06-01T00:00:00Z'),
        _cert(id: '2', expiresAt: '2026-08-22T00:00:00Z'),
        _cert(id: '3', expiresAt: '2027-01-01T00:00:00Z'),
      ];
      final out = filterCertsExpiringWithin(input, 90, now: now);
      expect(out.map((c) => c.id), ['1', '2']);
    });

    test('keeps already-expired certs (negative days)', () {
      final input = [
        _cert(id: 'past', expiresAt: '2026-01-01T00:00:00Z'),
        _cert(id: 'fresh', expiresAt: '2026-06-01T00:00:00Z'),
      ];
      final out = filterCertsExpiringWithin(input, 90, now: now);
      // Both kept — past is "very expiring", fresh is within window.
      expect(out.length, 2);
    });

    test('drops certs with null expiresAt (no expiry = never expiring)', () {
      final input = [
        _cert(id: 'no-exp', expiresAt: null),
        _cert(id: 'soon', expiresAt: '2026-06-10T00:00:00Z'),
      ];
      final out = filterCertsExpiringWithin(input, 90, now: now);
      expect(out.map((c) => c.id), ['soon']);
    });

    test('respects custom window size (30 days)', () {
      final input = [
        _cert(id: 'in16', expiresAt: '2026-06-10T00:00:00Z'), // +16d
        _cert(id: 'in46', expiresAt: '2026-07-10T00:00:00Z'), // +46d
      ];
      final out = filterCertsExpiringWithin(input, 30, now: now);
      expect(out.map((c) => c.id), ['in16']);
    });

    test('empty input → empty output', () {
      expect(filterCertsExpiringWithin([], 90, now: now), isEmpty);
    });
  });

  group('Certificate.fromJson', () {
    test('parses full payload with nested certificateType', () {
      final c = Certificate.fromJson({
        'id': 'cert-1',
        'subjectType': 'vessel',
        'subjectId': 'v-1',
        'number': 'SOLAS-123',
        'issuedBy': 'DNV',
        'expiresAt': '2026-12-31T23:59:59Z',
        'certificateType': {'id': 'ct-1', 'name': 'SOLAS Certificate'},
      });
      expect(c.id, 'cert-1');
      expect(c.subjectType, 'vessel');
      expect(c.number, 'SOLAS-123');
      expect(c.issuedBy, 'DNV');
      expect(c.expiresAt, DateTime.utc(2026, 12, 31, 23, 59, 59));
      expect(c.certificateType?.name, 'SOLAS Certificate');
    });

    test('tolerates missing optional fields', () {
      final c = Certificate.fromJson({'id': 'cert-2'});
      expect(c.id, 'cert-2');
      expect(c.expiresAt, isNull);
      expect(c.certificateType, isNull);
    });

    test('daysUntilExpiry returns null when expiresAt is null', () {
      final c = Certificate.fromJson({'id': 'c'});
      expect(c.daysUntilExpiry(), isNull);
    });
  });
}
