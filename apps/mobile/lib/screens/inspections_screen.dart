import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../widgets/entity_list_scaffold.dart';

class InspectionsScreen extends StatelessWidget {
  const InspectionsScreen({super.key});

  static const _kinds = ['PSC', 'VETTING', 'FLAG'];
  static const _statuses = ['OPEN', 'CLOSED'];

  @override
  Widget build(BuildContext context) {
    return EntityListScaffold(
      title: 'Inspections (PSC / Vetting / Flag)',
      endpoint: '/inspections',
      createTooltip: 'Log Inspection',
      emptyMessage: 'No inspections yet.',
      itemBuilder: (ctx, item) {
        final detained = item['detained'] == true;
        final deficiencies = item['deficiencies'] is num ? item['deficiencies'] : 0;
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: ListTile(
            leading: Icon(
              Icons.security_outlined,
              color: detained
                  ? const Color(0xFFAB382E)
                  : deficiencies > 0
                      ? const Color(0xFFB5731E)
                      : const Color(0xFF2F7D4F),
            ),
            title: Text('${item['kind']} · ${item['port']}',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Inspector: ${item['inspector']}'),
                Text('${_formatDate(item['inspectedAt'])} · '
                    'deficiencies: $deficiencies'
                    '${detained ? ' · DETAINED' : ''}'),
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
        const SnackBar(content: Text('No vessel context — cannot create.')),
      );
      return false;
    }
    String kind = _kinds.first;
    String status = _statuses.first;
    final inspectedCtrl = TextEditingController(
        text: DateTime.now().toUtc().toIso8601String());
    final mouCtrl = TextEditingController();
    final portCtrl = TextEditingController();
    final inspectorCtrl = TextEditingController();
    final deficienciesCtrl = TextEditingController(text: '0');
    bool detained = false;
    final findingsCtrl = TextEditingController();

    return showDialog<bool>(
      context: ctx,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (stateCtx, setSt) => AlertDialog(
          title: const Text('Log Inspection'),
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
                  controller: inspectedCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Inspected at (ISO UTC)'),
                ),
                TextField(
                  controller: mouCtrl,
                  decoration:
                      const InputDecoration(labelText: 'MoU (e.g. Paris, Tokyo)'),
                ),
                TextField(
                  controller: portCtrl,
                  decoration: const InputDecoration(labelText: 'Port'),
                ),
                TextField(
                  controller: inspectorCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Inspector name'),
                ),
                TextField(
                  controller: deficienciesCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Deficiencies'),
                ),
                SwitchListTile(
                  value: detained,
                  onChanged: (v) => setSt(() => detained = v),
                  title: const Text('Detained'),
                  contentPadding: EdgeInsets.zero,
                ),
                TextField(
                  controller: findingsCtrl,
                  decoration: const InputDecoration(labelText: 'Findings'),
                  maxLines: 3,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(dialogCtx, false),
                child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                final ok = await submitCreateForm(
                  sheetCtx: dialogCtx,
                  onSubmit: () async {
                    await client.post('/inspections', {
                      'vesselId': vesselId,
                      'inspectedAt': inspectedCtrl.text.trim(),
                      'kind': kind,
                      if (mouCtrl.text.trim().isNotEmpty)
                        'mou': mouCtrl.text.trim(),
                      'port': portCtrl.text.trim(),
                      'inspector': inspectorCtrl.text.trim(),
                      'deficiencies':
                          int.tryParse(deficienciesCtrl.text.trim()) ?? 0,
                      'detained': detained,
                      'status': status,
                      if (findingsCtrl.text.trim().isNotEmpty)
                        'findings': findingsCtrl.text.trim(),
                    });
                  },
                );
                if (ok && dialogCtx.mounted) Navigator.pop(dialogCtx, true);
              },
              child: const Text('Save'),
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
