import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:fleetops_mobile/utils/request_bodies.dart';

void main() {
  group('buildRestHoursBody', () {
    test('includes required vesselId (regression: was missing → 400)', () {
      final body = buildRestHoursBody(
        vesselId: 'vessel-1',
        crewMemberId: 'crew-1',
        date: '2026-05-25',
        hoursWorked: List.filled(24, false),
      );
      expect(body.containsKey('vesselId'), isTrue,
          reason: 'CreateRestHourEntryDto requires vesselId');
      expect(body['vesselId'], 'vessel-1');
    });

    test('encodes hoursWorked as JSON string', () {
      final hours = List<bool>.generate(24, (i) => i.isEven);
      final body = buildRestHoursBody(
        vesselId: 'v',
        crewMemberId: 'c',
        date: '2026-05-25',
        hoursWorked: hours,
      );
      expect(body['hoursWorkedJson'], isA<String>());
      final decoded = jsonDecode(body['hoursWorkedJson'] as String) as List<dynamic>;
      expect(decoded.length, 24);
      expect(decoded[0], true);
      expect(decoded[1], false);
    });

    test('throws if hoursWorked is not exactly 24 entries', () {
      expect(
        () => buildRestHoursBody(
          vesselId: 'v',
          crewMemberId: 'c',
          date: '2026-05-25',
          hoursWorked: List.filled(23, false),
        ),
        throwsArgumentError,
      );
    });

    test('matches the exact DTO field set', () {
      final body = buildRestHoursBody(
        vesselId: 'v',
        crewMemberId: 'c',
        date: '2026-05-25',
        hoursWorked: List.filled(24, false),
      );
      // Snapshot of the field set so adding/removing keys requires updating
      // both this test and the vessel DTO at the same time.
      expect(
        body.keys.toSet(),
        equals({'vesselId', 'crewMemberId', 'date', 'hoursWorkedJson'}),
      );
    });
  });

  group('buildSignChecklistItemBody', () {
    test('includes signedByUserId and signedAt (regression: were missing → 400)', () {
      final body = buildSignChecklistItemBody(
        itemId: 'item-1',
        signedByUserId: 'user-1',
        signedAt: DateTime.utc(2026, 5, 25, 12, 30, 0),
      );
      expect(body['itemId'], 'item-1');
      expect(body['signedByUserId'], 'user-1');
      expect(body['signedAt'], '2026-05-25T12:30:00.000Z');
      expect(body['checked'], true);
    });

    test('signedAt is normalised to UTC ISO-8601', () {
      final local = DateTime(2026, 5, 25, 12, 0, 0); // local time
      final body = buildSignChecklistItemBody(
        itemId: 'i',
        signedByUserId: 'u',
        signedAt: local,
      );
      // toUtc() + toIso8601String() always ends in Z
      expect((body['signedAt'] as String).endsWith('Z'), isTrue);
    });

    test('checked defaults to true; can be overridden to false', () {
      final t = DateTime.utc(2026, 5, 25);
      final defaulted = buildSignChecklistItemBody(
        itemId: 'i', signedByUserId: 'u', signedAt: t);
      expect(defaulted['checked'], true);

      final unchecked = buildSignChecklistItemBody(
        itemId: 'i', signedByUserId: 'u', signedAt: t, checked: false);
      expect(unchecked['checked'], false);
    });

    test('signatureKey is omitted when not provided', () {
      final body = buildSignChecklistItemBody(
        itemId: 'i',
        signedByUserId: 'u',
        signedAt: DateTime.utc(2026, 5, 25),
      );
      expect(body.containsKey('signatureKey'), isFalse);
    });

    test('signatureKey is included when provided', () {
      final body = buildSignChecklistItemBody(
        itemId: 'i',
        signedByUserId: 'u',
        signedAt: DateTime.utc(2026, 5, 25),
        signatureKey: 'sig-abc',
      );
      expect(body['signatureKey'], 'sig-abc');
    });
  });
}
