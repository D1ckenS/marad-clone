// H15 — Pairing payload parser. Mirrors the JSON envelope produced by
// the vessel SPA's MobilePairPage (`apps/web-shore/src/pages/MobilePairPage.tsx`).
//
// Extracted as a pure top-level function so it's covered by a unit
// test without spinning up the camera scanner widget. Returns null on
// any malformed input — the caller decides how to surface the error.

import 'dart:convert';

class PairingPayload {
  final String baseUrl;
  final String tenantId;
  const PairingPayload({required this.baseUrl, required this.tenantId});

  @override
  bool operator ==(Object other) =>
      other is PairingPayload && other.baseUrl == baseUrl && other.tenantId == tenantId;

  @override
  int get hashCode => Object.hash(baseUrl, tenantId);
}

/// Parse a QR's raw text into a [PairingPayload].
///
/// Expected shape (matching `buildPairingPayload` in MobilePairPage.tsx):
/// ```json
/// { "v": 1, "kind": "fleetops-vessel-pairing",
///   "baseUrl": "http://192.168.1.5:3001",
///   "tenantId": "01ABC..." }
/// ```
///
/// Returns null on any of: non-JSON text, wrong `kind`, wrong `v`,
/// missing/empty fields, baseUrl that doesn't parse as http(s).
PairingPayload? parsePairingPayload(String raw) {
  if (raw.isEmpty) return null;
  dynamic decoded;
  try {
    decoded = jsonDecode(raw);
  } catch (_) {
    return null;
  }
  if (decoded is! Map<String, dynamic>) return null;

  if (decoded['kind'] != 'fleetops-vessel-pairing') return null;
  if (decoded['v'] != 1) return null;

  final baseUrl = decoded['baseUrl'];
  final tenantId = decoded['tenantId'];
  if (baseUrl is! String || tenantId is! String) return null;
  final trimmedBase = baseUrl.trim();
  final trimmedTenant = tenantId.trim();
  if (trimmedBase.isEmpty || trimmedTenant.isEmpty) return null;

  final uri = Uri.tryParse(trimmedBase);
  if (uri == null) return null;
  if (uri.scheme != 'http' && uri.scheme != 'https') return null;
  if (uri.host.isEmpty) return null;

  return PairingPayload(baseUrl: trimmedBase, tenantId: trimmedTenant);
}
