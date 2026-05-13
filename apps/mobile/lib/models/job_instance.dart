class JobModel {
  final String id;
  final String componentId;
  final String title;
  final String? description;
  final String priority;

  const JobModel({
    required this.id,
    required this.componentId,
    required this.title,
    this.description,
    required this.priority,
  });

  factory JobModel.fromJson(Map<String, dynamic> json) => JobModel(
        id: json['id'] as String,
        componentId: json['componentId'] as String,
        title: json['title'] as String,
        description: json['description'] as String?,
        priority: json['priority'] as String? ?? 'NORMAL',
      );
}

class JobInstance {
  final String id;
  final String jobId;
  final String componentId;
  final String status;
  final DateTime? dueAt;
  final String? assignedToUserId;
  final String createdAt;
  final String updatedAt;

  const JobInstance({
    required this.id,
    required this.jobId,
    required this.componentId,
    required this.status,
    this.dueAt,
    this.assignedToUserId,
    required this.createdAt,
    required this.updatedAt,
  });

  factory JobInstance.fromJson(Map<String, dynamic> json) => JobInstance(
        id: json['id'] as String,
        jobId: json['jobId'] as String,
        componentId: json['componentId'] as String,
        status: json['status'] as String,
        dueAt: json['dueAt'] != null
            ? DateTime.parse(json['dueAt'] as String)
            : null,
        assignedToUserId: json['assignedToUserId'] as String?,
        createdAt: json['createdAt'] as String,
        updatedAt: json['updatedAt'] as String,
      );

  bool get isDone => status == 'DONE';
  bool get isPending => status == 'PENDING';
  bool get isInProgress => status == 'IN_PROGRESS';
}
