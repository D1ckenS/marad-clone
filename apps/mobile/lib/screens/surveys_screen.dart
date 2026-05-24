import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../widgets/entity_list_scaffold.dart';

class SurveysScreen extends StatelessWidget {
  const SurveysScreen({super.key});

  static const _statuses = [
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'POSTPONED',
    'CANCELLED',
  ];

  @override
  Widget build(BuildContext context) {
    return EntityListScaffold(
      title: 'surveys.title'.tr(),
      endpoint: '/surveys',
      createTooltip: 'surveys.create_button'.tr(),
      emptyMessage: 'surveys.empty'.tr(),
      itemBuilder: (ctx, item) {
        final status = item['status']?.toString() ?? 'SCHEDULED';
        final color = status == 'COMPLETED'
            ? const Color(0xFF2F7D4F)
            : status == 'CANCELLED'
                ? const Color(0xFFAB382E)
                : const Color(0xFFB5731E);
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: ListTile(
            leading: const Icon(Icons.assignment_outlined),
            title: Text(
              '${item['kind']} · ${item['scope']}',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Surveyor: ${item['surveyor']}'),
                Text(
                  '${_formatDate(item['scheduledAt'])} · ${item['location']}',
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
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
      onCreate: (ctx, client, vesselId) =>
          _showCreateDialog(ctx, client, vesselId),
    );
  }

  Future<bool?> _showCreateDialog(
      BuildContext ctx, ApiClient client, String? vesselId) async {
    if (vesselId == null) {
      ScaffoldMessenger.of(ctx).showSnackBar(
        SnackBar(content: Text('common.vessel_context_missing'.tr())),
      );
      return false;
    }
    String status = _statuses.first;
    final kindCtrl = TextEditingController();
    final scopeCtrl = TextEditingController();
    final surveyorCtrl = TextEditingController();
    final locationCtrl = TextEditingController();
    final scheduledCtrl = TextEditingController(
        text: DateTime.now().toUtc().toIso8601String());
    final notesCtrl = TextEditingController();

    return showDialog<bool>(
      context: ctx,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (stateCtx, setSt) => AlertDialog(
          title: Text('surveys.create_title'.tr()),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: kindCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Kind (e.g. annual, intermediate)'),
                ),
                TextField(
                  controller: scopeCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Scope (e.g. hull & machinery)'),
                ),
                TextField(
                  controller: surveyorCtrl,
                  decoration: const InputDecoration(labelText: 'Surveyor'),
                ),
                TextField(
                  controller: locationCtrl,
                  decoration: const InputDecoration(labelText: 'Location / port'),
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
                  controller: notesCtrl,
                  decoration: const InputDecoration(labelText: 'Notes'),
                  maxLines: 2,
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
                    await client.post('/surveys', {
                      'vesselId': vesselId,
                      'kind': kindCtrl.text.trim(),
                      'scope': scopeCtrl.text.trim(),
                      'surveyor': surveyorCtrl.text.trim(),
                      'location': locationCtrl.text.trim(),
                      'scheduledAt': scheduledCtrl.text.trim(),
                      'status': status,
                      if (notesCtrl.text.trim().isNotEmpty)
                        'notes': notesCtrl.text.trim(),
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
