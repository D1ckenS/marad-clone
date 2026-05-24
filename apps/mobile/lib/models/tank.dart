/// Typed view of a Tank row from the vessel API.
/// Mirrors the shape returned by `GET /tanks`. Note: the vessel endpoint
/// does NOT include nested readings — those must be fetched separately via
/// `GET /tank-readings?tankId=X` (see [TankReading]).
class Tank {
  final String id;
  final String vesselId;
  final String name;
  final String? tankType;
  final String? capacityM3;
  final String? fuelProductId;
  final String? framePosition;

  const Tank({
    required this.id,
    required this.vesselId,
    required this.name,
    this.tankType,
    this.capacityM3,
    this.fuelProductId,
    this.framePosition,
  });

  factory Tank.fromJson(Map<String, dynamic> json) => Tank(
        id: json['id'] as String,
        vesselId: json['vesselId'] as String,
        name: json['name'] as String? ?? 'Tank',
        tankType: json['tankType'] as String?,
        capacityM3: json['capacityM3']?.toString(),
        fuelProductId: json['fuelProductId'] as String?,
        framePosition: json['framePosition'] as String?,
      );
}

/// Typed view of a TankReading row. `GET /tank-readings?vesselId=X` returns
/// these sorted by `readingDate` DESC, so the first reading per `tankId` is
/// the most recent.
class TankReading {
  final String id;
  final String tankId;
  final String readingDate;
  final String robMt;
  final String? robM3;
  final String? trim;

  const TankReading({
    required this.id,
    required this.tankId,
    required this.readingDate,
    required this.robMt,
    this.robM3,
    this.trim,
  });

  factory TankReading.fromJson(Map<String, dynamic> json) => TankReading(
        id: json['id'] as String,
        tankId: json['tankId'] as String,
        readingDate: json['readingDate'] as String? ?? '',
        robMt: json['robMt']?.toString() ?? '0',
        robM3: json['robM3']?.toString(),
        trim: json['trim']?.toString(),
      );
}
