/// Typed view of a CrewMember row from the vessel API.
/// Mirrors the shape returned by `GET /crew-members`.
class CrewMember {
  final String id;
  final String vesselId;
  final String firstName;
  final String lastName;
  final String? rank;
  final String? status;
  final String? signOnDate;
  final String? signOffDate;

  const CrewMember({
    required this.id,
    required this.vesselId,
    required this.firstName,
    required this.lastName,
    this.rank,
    this.status,
    this.signOnDate,
    this.signOffDate,
  });

  factory CrewMember.fromJson(Map<String, dynamic> json) => CrewMember(
        id: json['id'] as String,
        vesselId: json['vesselId'] as String,
        firstName: json['firstName'] as String? ?? '',
        lastName: json['lastName'] as String? ?? '',
        rank: json['rank'] as String?,
        status: json['status'] as String?,
        signOnDate: json['signOnDate'] as String?,
        signOffDate: json['signOffDate'] as String?,
      );

  String get fullName => '$firstName $lastName'.trim();
  String get initials =>
      '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}';
}
