import 'package:flutter/material.dart';

class RobStatusChip extends StatelessWidget {
  final String status;
  const RobStatusChip({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final (icon, color, tooltip) = switch (status) {
      'green' => (Icons.check_circle, Colors.green, 'OK'),
      'amber' => (Icons.warning_amber, Colors.orange, 'Low'),
      'red' => (Icons.cancel, Colors.red, 'Out of stock'),
      'purple' => (Icons.help_outline, Colors.purple, 'No config'),
      _ => (Icons.help_outline, Colors.grey, status),
    };
    return Tooltip(
      message: tooltip,
      child: Icon(icon, color: color, size: 28),
    );
  }
}
