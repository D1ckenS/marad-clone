import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../widgets/entity_list_scaffold.dart';

class ConditionsOfClassScreen extends StatelessWidget {
  const ConditionsOfClassScreen({super.key});

  static const _severities = [
    'CONDITION',
    'RECOMMENDATION',
    'MEMORANDUM',
    'CLOSED',
  ];

  @override
  Widget build(BuildContext context) {
    return EntityListScaffold(
      title: 'conditions_of_class.title'.tr(),
      endpoint: '/conditions-of-class',
      createTooltip: 'conditions_of_class.create_button'.tr(),
      emptyMessage: 'conditions_of_class.empty'.tr(),
      itemBuilder: (ctx, item) {
        final sev = item['severity']?.toString() ?? '';
        final color = sev == 'CONDITION'
            ? const Color(0xFFAB382E)
            : sev == 'RECOMMENDATION'
                ? const Color(0xFFB5731E)
                : sev == 'MEMORANDUM'
                    ? const Color(0xFF1F5B9D)
                    : Colors.grey;
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: ListTile(
            leading: Icon(Icons.gavel_outlined, color: color),
            title: Text(item['title']?.toString() ?? '—',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(sev,
                    style: TextStyle(color: color, fontWeight: FontWeight.bold)),
                Text('Raised: ${_formatDate(item['raisedAt'])}'
                    '${item['dueAt'] != null ? ' · Due: ${_formatDate(item['dueAt'])}' : ''}'),
              ],
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
    String severity = _severities.first;
    final titleCtrl = TextEditingController();
    final detailCtrl = TextEditingController();
    final raisedCtrl = TextEditingController(
        text: DateTime.now().toUtc().toIso8601String());
    final openedCtrl = TextEditingController(
        text: DateTime.now().toUtc().toIso8601String());
    final dueCtrl = TextEditingController();

    return showDialog<bool>(
      context: ctx,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (stateCtx, setSt) => AlertDialog(
          title: Text('conditions_of_class.create_title'.tr()),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: severity,
                  decoration: const InputDecoration(labelText: 'Severity'),
                  items: _severities
                      .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                      .toList(),
                  onChanged: (v) => setSt(() => severity = v!),
                ),
                TextField(
                  controller: titleCtrl,
                  decoration: const InputDecoration(labelText: 'Title'),
                ),
                TextField(
                  controller: detailCtrl,
                  decoration: const InputDecoration(labelText: 'Detail'),
                  maxLines: 3,
                ),
                TextField(
                  controller: raisedCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Raised at (ISO UTC)'),
                ),
                TextField(
                  controller: openedCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Opened at (ISO UTC)'),
                ),
                TextField(
                  controller: dueCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Due at (optional, ISO UTC)'),
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
                    await client.post('/conditions-of-class', {
                      'vesselId': vesselId,
                      'severity': severity,
                      'title': titleCtrl.text.trim(),
                      'detail': detailCtrl.text.trim(),
                      'raisedAt': raisedCtrl.text.trim(),
                      'openedAt': openedCtrl.text.trim(),
                      if (dueCtrl.text.trim().isNotEmpty)
                        'dueAt': dueCtrl.text.trim(),
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
    if (v == null) return '—';
    final d = DateTime.tryParse(v.toString());
    return d == null ? v.toString() : d.toLocal().toString().split(' ').first;
  }
}
