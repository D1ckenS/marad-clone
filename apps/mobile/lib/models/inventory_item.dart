class InventoryItem {
  final String id;
  final String partNumber;
  final String name;
  final String? unit;
  final List<StockLevelEntry> stockLevels;

  const InventoryItem({
    required this.id,
    required this.partNumber,
    required this.name,
    this.unit,
    required this.stockLevels,
  });

  factory InventoryItem.fromJson(Map<String, dynamic> json) {
    final levels = (json['stockLevels'] as List<dynamic>? ?? [])
        .map((l) => StockLevelEntry.fromJson(l as Map<String, dynamic>))
        .toList();
    return InventoryItem(
      id: json['id'] as String,
      partNumber: json['partNumber'] as String,
      name: json['name'] as String,
      unit: json['unit'] as String?,
      stockLevels: levels,
    );
  }

  /// Returns the worst status across all locations (red > amber > purple > green).
  String get overallStatus {
    if (stockLevels.isEmpty) return 'purple';
    final statuses = stockLevels.map((l) => l.status).toSet();
    if (statuses.contains('red')) return 'red';
    if (statuses.contains('amber')) return 'amber';
    if (statuses.contains('purple')) return 'purple';
    return 'green';
  }
}

class StockLevelEntry {
  final String id;
  final String locationId;
  final String locationName;
  final double rob;
  final String status;
  final String? minStock;
  final String? maxStock;
  final String? reorderPoint;

  const StockLevelEntry({
    required this.id,
    required this.locationId,
    required this.locationName,
    required this.rob,
    required this.status,
    this.minStock,
    this.maxStock,
    this.reorderPoint,
  });

  factory StockLevelEntry.fromJson(Map<String, dynamic> json) => StockLevelEntry(
        id: json['id'] as String,
        locationId: json['locationId'] as String,
        locationName: json['locationName'] as String,
        rob: double.tryParse(json['rob']?.toString() ?? '0') ?? 0.0,
        status: json['status'] as String? ?? 'green',
        minStock: json['minStock'] as String?,
        maxStock: json['maxStock'] as String?,
        reorderPoint: json['reorderPoint'] as String?,
      );
}
