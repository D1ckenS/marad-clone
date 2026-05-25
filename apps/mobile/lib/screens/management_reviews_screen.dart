import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../widgets/entity_list_scaffold.dart';

class ManagementReviewsScreen extends StatelessWidget {
  const ManagementReviewsScreen({super.key});

  static const _statuses = ['SCHEDULED', 'IN_PROGRESS', 'CLOSED', 'CANCELLED'];

  @override
  Widget build(BuildContext context) {
    return EntityListScaffold(
      title: 'management_reviews.title'.tr(),
      endpoint: '/management-reviews',
      createTooltip: 'management_reviews.create_button'.tr(),
      emptyMessage: 'management_reviews.empty'.tr(),
      itemBuilder: (ctx, item) {
        final status = item['status']?.toString() ?? 'SCHEDULED';
        final color = status == 'CLOSED'
            ? const Color(0xFF2F7D4F)
            : status == 'CANCELLED'
                ? const Color(0xFFAB382E)
                : const Color(0xFFB5731E);
        final done = item['actionsDone'];
        final total = item['actionsTotal'];
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: ListTile(
            leading: const Icon(Icons.event_note_outlined),
            title: Text(item['kind']?.toString() ?? 'Review',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Chair: ${item['chair']}'),
                Text(
                    '${_formatDate(item['scheduledAt'])}'
                    '${item['attendees'] != null ? ' · ${item['attendees']} attendees' : ''}'
                    '${total != null ? ' · actions ${done ?? 0}/$total' : ''}',
                    style: const TextStyle(fontSize: 12, color: Colors.grey)),
              ],
            ),
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(status,
                  style: TextStyle(
                      color: color, fontSize: 11, fontWeight: FontWeight.bold)),
            ),
            isThreeLine: true,
          ),
        );
      },
      onCreate: (ctx, client, vesselId) => _showCreateDialog(ctx, client),
    );
  }

  Future<bool?> _showCreateDialog(BuildContext ctx, ApiClient client) async {
    String status = _statuses.first;
    final kindCtrl = TextEditingController();
    final chairCtrl = TextEditingController();
    final scheduledCtrl = TextEditingController(
        text: DateTime.now().toUtc().toIso8601String());
    final attendeesCtrl = TextEditingController(text: '0');
    final actionsTotalCtrl = TextEditingController(text: '0');
    final actionsDoneCtrl = TextEditingController(text: '0');
    final summaryCtrl = TextEditingController();

    return showDialog<bool>(
      context: ctx,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (stateCtx, setSt) => AlertDialog(
          title: Text('management_reviews.create_title'.tr()),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: kindCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Kind (e.g. quarterly)'),
                ),
                TextField(
                  controller: chairCtrl,
                  decoration: const InputDecoration(labelText: 'Chair'),
                ),
                TextField(
                  controller: scheduledCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Scheduled at (ISO UTC)'),
                ),
                DropdownButtonFormField<String>(
                  initialValue: status,
                  decoration: const InputDecoration(labelText: 'Status'),
                  items: _statuses
                      .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                      .toList(),
                  onChanged: (v) => setSt(() => status = v!),
                ),
                TextField(
                  controller: attendeesCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Attendees'),
                ),
                Row(children: [
                  Expanded(
                    child: TextField(
                      controller: actionsTotalCtrl,
                      keyboardType: TextInputType.number,
                      decoration:
                          const InputDecoration(labelText: 'Actions total'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: actionsDoneCtrl,
                      keyboardType: TextInputType.number,
                      decoration:
                          const InputDecoration(labelText: 'Actions done'),
                    ),
                  ),
                ]),
                TextField(
                  controller: summaryCtrl,
                  decoration: const InputDecoration(labelText: 'Summary'),
                  maxLines: 3,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(dialogCtx, false),
                child: Text('common.cancel'.tr())),
            FilledButton(
              onPressed: () async {
                final ok = await submitCreateForm(
                  sheetCtx: dialogCtx,
                  onSubmit: () async {
                    await client.post('/management-reviews', {
                      'kind': kindCtrl.text.trim(),
                      'chair': chairCtrl.text.trim(),
                      'scheduledAt': scheduledCtrl.text.trim(),
                      'status': status,
                      'attendees':
                          int.tryParse(attendeesCtrl.text.trim()) ?? 0,
                      'actionsTotal':
                          int.tryParse(actionsTotalCtrl.text.trim()) ?? 0,
                      'actionsDone':
                          int.tryParse(actionsDoneCtrl.text.trim()) ?? 0,
                      if (summaryCtrl.text.trim().isNotEmpty)
                        'summary': summaryCtrl.text.trim(),
                    });
                  },
                );
                if (ok && dialogCtx.mounted) Navigator.pop(dialogCtx, true);
              },
              child: Text('common.save'.tr()),
            ),
          ],
        ),
      ),
    );
  }

  static String _formatDate(dynamic v) {
    if (v == null) return '';
    final d = DateTime.tryParse(v.toString());
    return d == null ? v.toString() : d.toLocal().toString().split(' ').first;
  }
}
