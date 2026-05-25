import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../widgets/entity_list_scaffold.dart';

class AuditFindingsScreen extends StatelessWidget {
  const AuditFindingsScreen({super.key});

  // ISM/ISO audit classifications.
  static const _classifications = ['MAJOR_NC', 'MINOR_NC', 'OBSERVATION', 'OFI'];

  @override
  Widget build(BuildContext context) {
    return EntityListScaffold(
      title: 'audit_findings.title'.tr(),
      endpoint: '/audit-findings',
      createTooltip: 'audit_findings.create_button'.tr(),
      emptyMessage: 'audit_findings.empty'.tr(),
      itemBuilder: (ctx, item) {
        final cls = item['classification']?.toString() ?? '';
        final color = cls == 'MAJOR_NC'
            ? const Color(0xFFAB382E)
            : cls == 'MINOR_NC'
                ? const Color(0xFFB5731E)
                : const Color(0xFF1F5B9D);
        final closed = item['closedAt'] != null;
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: ListTile(
            leading: Icon(
              closed ? Icons.task_alt : Icons.flag_outlined,
              color: closed ? Colors.grey : color,
            ),
            title: Text(item['title']?.toString() ?? '—',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(cls, style: TextStyle(color: color, fontWeight: FontWeight.bold)),
                Text('Opened: ${_formatDate(item['openedAt'])}'
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
    String classification = _classifications[1];
    final titleCtrl = TextEditingController();
    final detailCtrl = TextEditingController();
    final smsRefCtrl = TextEditingController();
    final ownerCtrl = TextEditingController();
    final openedCtrl = TextEditingController(
        text: DateTime.now().toUtc().toIso8601String());
    final dueCtrl = TextEditingController();

    return showDialog<bool>(
      context: ctx,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (stateCtx, setSt) => AlertDialog(
          title: Text('audit_findings.create_title'.tr()),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: classification,
                  decoration: const InputDecoration(labelText: 'Classification'),
                  items: _classifications
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (v) => setSt(() => classification = v!),
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
                  controller: smsRefCtrl,
                  decoration: const InputDecoration(labelText: 'SMS reference (e.g. SMS-3.4)'),
                ),
                TextField(
                  controller: ownerCtrl,
                  decoration: const InputDecoration(labelText: 'Owner (e.g. Master, CO)'),
                ),
                TextField(
                  controller: openedCtrl,
                  decoration: const InputDecoration(labelText: 'Opened at (ISO UTC)'),
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
                    await client.post('/audit-findings', {
                      'vesselId': vesselId,
                      'classification': classification,
                      'title': titleCtrl.text.trim(),
                      if (detailCtrl.text.trim().isNotEmpty)
                        'detail': detailCtrl.text.trim(),
                      if (smsRefCtrl.text.trim().isNotEmpty)
                        'smsRef': smsRefCtrl.text.trim(),
                      if (ownerCtrl.text.trim().isNotEmpty)
                        'owner': ownerCtrl.text.trim(),
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
