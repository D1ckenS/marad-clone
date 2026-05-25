/// Typed view of a Drill row from the vessel API.
/// Mirrors the shape returned by `GET /drills`.
class Drill {
  final String id;
  final String vesselId;
  final String? drillTypeId;
  final DrillType? drillType;
  final String status; // SCHEDULED | COMPLETED | CANCELLED
  final DateTime? scheduledAt;
  final String? location;
  final String? leadOfficer;

  const Drill({
    required this.id,
    required this.vesselId,
    this.drillTypeId,
    this.drillType,
    required this.status,
    this.scheduledAt,
    this.location,
    this.leadOfficer,
  });

  factory Drill.fromJson(Map<String, dynamic> json) => Drill(
        id: json['id'] as String,
        vesselId: json['vesselId'] as String,
        drillTypeId: json['drillTypeId'] as String?,
        drillType: json['drillType'] is Map<String, dynamic>
            ? DrillType.fromJson(json['drillType'] as Map<String, dynamic>)
            : null,
        status: json['status'] as String? ?? 'SCHEDULED',
        scheduledAt: json['scheduledAt'] != null
            ? DateTime.tryParse(json['scheduledAt'] as String)
            : null,
        location: json['location'] as String?,
        leadOfficer: json['leadOfficer'] as String?,
      );

  String get drillTypeName => drillType?.name ?? 'Drill';
  bool get isScheduled => status == 'SCHEDULED';
}

class DrillType {
  final String? id;
  final String? name;

  const DrillType({this.id, this.name});

  factory DrillType.fromJson(Map<String, dynamic> json) => DrillType(
        id: json['id'] as String?,
        name: json['name'] as String?,
      );
}
