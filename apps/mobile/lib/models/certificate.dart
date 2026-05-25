/// Typed view of a Certificate row from the vessel API. Mirrors the shape
/// returned by `GET /certificates`. Lifted out of `certificates_screen.dart`
/// so a server-side rename (e.g. `expiresAt` → `expires_at`) breaks at this
/// boundary in tests rather than at runtime in the UI.
class Certificate {
  final String id;
  final String? subjectType;
  final String? subjectId;
  final String? number;
  final String? issuedBy;
  final DateTime? expiresAt;
  final CertificateType? certificateType;

  const Certificate({
    required this.id,
    this.subjectType,
    this.subjectId,
    this.number,
    this.issuedBy,
    this.expiresAt,
    this.certificateType,
  });

  factory Certificate.fromJson(Map<String, dynamic> json) => Certificate(
        id: json['id'] as String,
        subjectType: json['subjectType'] as String?,
        subjectId: json['subjectId'] as String?,
        number: json['number'] as String?,
        issuedBy: json['issuedBy'] as String?,
        expiresAt: json['expiresAt'] != null
            ? DateTime.tryParse(json['expiresAt'] as String)
            : null,
        certificateType: json['certificateType'] is Map<String, dynamic>
            ? CertificateType.fromJson(json['certificateType'] as Map<String, dynamic>)
            : null,
      );

  /// Days remaining until expiry, relative to [now] (or DateTime.now()).
  /// Returns null if there is no expiry date set.
  int? daysUntilExpiry({DateTime? now}) {
    if (expiresAt == null) return null;
    return expiresAt!.difference(now ?? DateTime.now()).inDays;
  }
}

class CertificateType {
  final String? id;
  final String? name;

  const CertificateType({this.id, this.name});

  factory CertificateType.fromJson(Map<String, dynamic> json) => CertificateType(
        id: json['id'] as String?,
        name: json['name'] as String?,
      );
}
