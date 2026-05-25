import 'dart:convert';

/// Typed view of a ChecklistInstance row from the vessel API.
/// Mirrors the shape returned by `GET /checklist-instances`.
///
/// The `responsesJson` column is stored as a JSON string on the vessel SQLite
/// side; we parse it eagerly here so callers don't have to.
class ChecklistInstance {
  final String id;
  final String vesselId;
  final String title;
  final String status; // OPEN | IN_PROGRESS | COMPLETED | CANCELLED
  final String? templateId;
  final List<ChecklistResponse> responses;

  const ChecklistInstance({
    required this.id,
    required this.vesselId,
    required this.title,
    required this.status,
    this.templateId,
    required this.responses,
  });

  factory ChecklistInstance.fromJson(Map<String, dynamic> json) {
    final raw = json['responsesJson'];
    final List<dynamic> parsed = raw is String && raw.isNotEmpty
        ? (jsonDecode(raw) as List<dynamic>)
        : raw is List
            ? raw
            : const [];
    return ChecklistInstance(
      id: json['id'] as String,
      vesselId: json['vesselId'] as String,
      title: json['title'] as String? ?? '',
      status: json['status'] as String? ?? 'OPEN',
      templateId: json['templateId'] as String?,
      responses: parsed
          .whereType<Map<String, dynamic>>()
          .map(ChecklistResponse.fromJson)
          .toList(),
    );
  }

  int get signedCount => responses.where((r) => r.signedAt != null).length;
  bool get isCompleted => status == 'COMPLETED';
}

class ChecklistResponse {
  final String itemId;
  final String? label;
  final bool checked;
  final String? signedAt;
  final String? signedByUserId;

  const ChecklistResponse({
    required this.itemId,
    this.label,
    required this.checked,
    this.signedAt,
    this.signedByUserId,
  });

  factory ChecklistResponse.fromJson(Map<String, dynamic> json) => ChecklistResponse(
        itemId: json['itemId'] as String,
        label: json['label'] as String?,
        checked: json['checked'] == true,
        signedAt: json['signedAt'] as String?,
        signedByUserId: json['signedByUserId'] as String?,
      );
}
