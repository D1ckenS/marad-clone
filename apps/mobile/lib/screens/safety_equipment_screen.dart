import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../widgets/entity_list_scaffold.dart';

class SafetyEquipmentScreen extends StatelessWidget {
  const SafetyEquipmentScreen({super.key});

  static const _categories = ['FFA', 'LSA', 'OTH'];
  static const _statuses = ['GREEN', 'AMBER', 'RED'];

  @override
  Widget build(BuildContext context) {
    return EntityListScaffold(
      title: 'Safety Equipment',
      endpoint: '/safety-equipment',
      createTooltip: 'Add Equipment',
      emptyMessage: 'No safety equipment records yet.',
      itemBuilder: (ctx, item) {
        final status = item['status']?.toString() ?? 'GREEN';
        final color = status == 'RED'
            ? const Color(0xFFAB382E)
            : status == 'AMBER'
                ? const Color(0xFFB5731E)
                : const Color(0xFF2F7D4F);
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: color.withValues(alpha: 0.15),
              child: Text(item['category']?.toString().substring(0, 1) ?? '?',
                  style: TextStyle(color: color, fontWeight: FontWeight.bold)),
            ),
            title: Text(item['name']?.toString() ?? '—',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text('${item['location']} · qty ${item['quantity']}'
                '${item['nextCheck'] != null ? ' · next: ${_formatDate(item['nextCheck'])}' : ''}'),
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
    String category = _categories.first;
    String status = _statuses.first;
    final nameCtrl = TextEditingController();
    final locCtrl = TextEditingController();
    final qtyCtrl = TextEditingController(text: '1');
    final lastCheckCtrl = TextEditingController();
    final nextCheckCtrl = TextEditingController();

    return showDialog<bool>(
      context: ctx,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (stateCtx, setSt) => AlertDialog(
          title: const Text('Add Safety Equipment'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: category,
                      decoration: const InputDecoration(labelText: 'Category'),
                      items: _categories
                          .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                          .toList(),
                      onChanged: (v) => setSt(() => category = v!),
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
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Name'),
                ),
                TextField(
                  controller: locCtrl,
                  decoration: const InputDecoration(labelText: 'Location'),
                ),
                TextField(
                  controller: qtyCtrl,
                  decoration: const InputDecoration(labelText: 'Quantity'),
                ),
                TextField(
                  controller: lastCheckCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Last check (ISO UTC, optional)'),
                ),
                TextField(
                  controller: nextCheckCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Next check (ISO UTC, optional)'),
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
                    await client.post('/safety-equipment', {
                      'vesselId': vesselId,
                      'category': category,
                      'name': nameCtrl.text.trim(),
                      'location': locCtrl.text.trim(),
                      'quantity': qtyCtrl.text.trim(),
                      if (lastCheckCtrl.text.trim().isNotEmpty)
                        'lastCheck': lastCheckCtrl.text.trim(),
                      if (nextCheckCtrl.text.trim().isNotEmpty)
                        'nextCheck': nextCheckCtrl.text.trim(),
                      'status': status,
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
    if (v == null) return '';
    final d = DateTime.tryParse(v.toString());
    return d == null ? v.toString() : d.toLocal().toString().split(' ').first;
  }
}
