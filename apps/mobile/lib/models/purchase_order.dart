/// Typed view of a PurchaseOrder + its lines from the vessel API.
/// Mirrors what `GET /purchase-orders` returns.
class PurchaseOrder {
  final String id;
  final String? number;
  final String status; // DRAFT | SENT | ACKNOWLEDGED | IN_TRANSIT | PARTIALLY_RECEIVED | CLOSED | CANCELLED
  final String? supplierName;
  final String? expectedAt;
  final List<PoLine> lines;

  const PurchaseOrder({
    required this.id,
    this.number,
    required this.status,
    this.supplierName,
    this.expectedAt,
    required this.lines,
  });

  factory PurchaseOrder.fromJson(Map<String, dynamic> json) {
    final rawLines = json['lines'] as List<dynamic>? ?? const [];
    final supplier = json['supplier'];
    return PurchaseOrder(
      id: json['id'] as String,
      number: json['number'] as String? ?? json['poNumber'] as String?,
      status: json['status'] as String? ?? 'DRAFT',
      supplierName: supplier is Map<String, dynamic>
          ? supplier['name'] as String?
          : json['supplierName'] as String?,
      expectedAt: json['expectedAt'] as String?,
      lines: rawLines
          .whereType<Map<String, dynamic>>()
          .map(PoLine.fromJson)
          .toList(),
    );
  }

  bool get isReceivable => const {
        'SENT',
        'ACKNOWLEDGED',
        'IN_TRANSIT',
        'PARTIALLY_RECEIVED',
      }.contains(status);
}

class PoLine {
  final String id;
  final String? partId;
  final String? description;
  final String quantity; // ordered
  final String unit;

  const PoLine({
    required this.id,
    this.partId,
    this.description,
    required this.quantity,
    required this.unit,
  });

  factory PoLine.fromJson(Map<String, dynamic> json) => PoLine(
        id: json['id'] as String,
        partId: json['partId'] as String?,
        description: json['description'] as String?,
        quantity: json['quantity']?.toString() ?? '0',
        unit: json['unit'] as String? ?? 'pcs',
      );
}
