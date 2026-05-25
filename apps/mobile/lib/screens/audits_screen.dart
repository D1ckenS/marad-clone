import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import '../services/outbox_service.dart';
import '../widgets/entity_list_scaffold.dart';

class AuditsScreen extends StatelessWidget {
  const AuditsScreen({super.key});

  static const _kinds = ['INTERNAL', 'EXTERNAL', 'CLASS', 'FLAG'];
  static const _statuses = [
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
  ];

  @override
  Widget build(BuildContext context) {
    return EntityListScaffold(
      title: 'audits.title'.tr(),
      endpoint: '/audits',
      createTooltip: 'audits.create_button'.tr(),
      emptyMessage: 'audits.empty'.tr(),
      itemBuilder: (ctx, item) {
        final status = item['status']?.toString() ?? 'SCHEDULED';
        final color = status == 'COMPLETED'
            ? const Color(0xFF2F7D4F)
            : status == 'CANCELLED'
                ? const Color(0xFFAB382E)
                : const Color(0xFFB5731E);
        final findings = item['findings'];
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: ListTile(
            leading: const Icon(Icons.fact_check_outlined),
            title: Text('${item['kind']} · ${item['scope']}',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Auditor: ${item['auditor']}'),
                Text(
                    '${_formatDate(item['scheduledAt'])}${findings != null ? ' · $findings findings' : ''}',
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
      onCreate: (ctx, outbox, _, vesselId) =>
          _showCreateDialog(ctx, outbox, vesselId),
    );
  }

  Future<bool?> _showCreateDialog(
      BuildContext ctx, OutboxService outbox, String? vesselId) async {
    String kind = _kinds.first;
    String status = _statuses.first;
    final scopeCtrl = TextEditingController();
    final auditorCtrl = TextEditingController();
    final scheduledCtrl = TextEditingController(
        text: DateTime.now().toUtc().toIso8601String());
    final findingsCtrl = TextEditingController(text: '0');

    return showDialog<bool>(
      context: ctx,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (stateCtx, setSt) => AlertDialog(
          title: Text('audits.create_title'.tr()),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: kind,
                      decoration: const InputDecoration(labelText: 'Kind'),
                      items: _kinds
                          .map((k) => DropdownMenuItem(value: k, child: Text(k)))
                          .toList(),
                      onChanged: (v) => setSt(() => kind = v!),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: status,
                      decoration: const InputDecoration(labelText: 'Status'),
                      items: _statuses
                          .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                          .toList(),
                      onChanged: (v) => setSt(() => status = v!),
                    ),
                  ),
                ]),
                TextField(
                  controller: scopeCtrl,
                  decoration: const InputDecoration(labelText: 'Scope'),
                ),
                TextField(
                  controller: auditorCtrl,
                  decoration: const InputDecoration(labelText: 'Auditor'),
                ),
                TextField(
                  controller: scheduledCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Scheduled at (ISO UTC)'),
                ),
                TextField(
                  controller: findingsCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Findings count'),
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
                    await outbox.postOrQueue('/audits', {
                      if (vesselId != null) 'vesselId': vesselId,
                      'kind': kind,
                      'scope': scopeCtrl.text.trim(),
                      'auditor': auditorCtrl.text.trim(),
                      'scheduledAt': scheduledCtrl.text.trim(),
                      'status': status,
                      'findings': int.tryParse(findingsCtrl.text.trim()) ?? 0,
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
