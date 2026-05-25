import 'dart:convert';

/// Pure-function builders for the POST bodies the mobile app sends to the
/// vessel API. Extracted from the screens so the body shape stays in lock-step
/// with the vessel DTOs and is covered by unit tests rather than living
/// inside an anonymous onPressed callback.
///
/// One builder per endpoint. If a vessel DTO changes, update the builder +
/// test in one place and every call-site picks it up.

/// `POST /rest-hour-entries` — see CreateRestHourEntryDto in api-vessel.
/// `vesselId` is required (it's a tenant+vessel-scoped resource on the
/// vessel SQLite).
Map<String, dynamic> buildRestHoursBody({
  required String vesselId,
  required String crewMemberId,
  required String date,
  required List<bool> hoursWorked,
}) {
  if (hoursWorked.length != 24) {
    throw ArgumentError('hoursWorked must have 24 entries, got ${hoursWorked.length}');
  }
  return {
    'vesselId': vesselId,
    'crewMemberId': crewMemberId,
    'date': date,
    'hoursWorkedJson': jsonEncode(hoursWorked),
  };
}

/// `POST /checklist-instances/:id/sign-item` — see SignChecklistItemDto in
/// api-vessel. `signedByUserId` is the JWT `sub` claim of the signer;
/// `signedAt` is the moment of signing (UTC ISO-8601).
Map<String, dynamic> buildSignChecklistItemBody({
  required String itemId,
  required String signedByUserId,
  required DateTime signedAt,
  bool checked = true,
  String? signatureKey,
}) {
  return {
    'itemId': itemId,
    'signedByUserId': signedByUserId,
    'signedAt': signedAt.toUtc().toIso8601String(),
    'checked': checked,
    if (signatureKey != null) 'signatureKey': signatureKey,
  };
}
