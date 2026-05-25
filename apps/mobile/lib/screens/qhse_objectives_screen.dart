import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../widgets/entity_list_scaffold.dart';

class QhseObjectivesScreen extends StatelessWidget {
  const QhseObjectivesScreen({super.key});

  static const _categories = ['Q', 'H', 'S', 'E'];
  static const _statuses = ['GREEN', 'AMBER', 'RED'];

  @override
  Widget build(BuildContext context) {
    return EntityListScaffold(
      title: 'qhse_objectives.title'.tr(),
      endpoint: '/qhse-objectives',
      createTooltip: 'qhse_objectives.create_button'.tr(),
      emptyMessage: 'qhse_objectives.empty'.tr(),
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
              child: Text(item['category']?.toString() ?? '?',
                  style: TextStyle(color: color, fontWeight: FontWeight.bold)),
            ),
            title: Text(item['label']?.toString() ?? '—',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(
              'Target ${item['target']} ${item['unit']} · Actual ${item['actual']} ${item['unit']}'
              '${item['delta'] != null ? ' (Δ ${item['delta']})' : ''}',
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
          ),
        );
      },
      onCreate: (ctx, client, vesselId) => _showCreateDialog(ctx, client),
    );
  }

  Future<bool?> _showCreateDialog(BuildContext ctx, ApiClient client) async {
    String category = _categories.first;
    String status = _statuses.first;
    final labelCtrl = TextEditingController();
    final targetCtrl = TextEditingController();
    final actualCtrl = TextEditingController();
    final unitCtrl = TextEditingController();
    final deltaCtrl = TextEditingController();

    return showDialog<bool>(
      context: ctx,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (stateCtx, setSt) => AlertDialog(
          title: Text('qhse_objectives.create_title'.tr()),
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
                  controller: labelCtrl,
                  decoration: const InputDecoration(labelText: 'Label'),
                ),
                Row(children: [
                  Expanded(
                    child: TextField(
                      controller: targetCtrl,
                      decoration: const InputDecoration(labelText: 'Target'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: actualCtrl,
                      decoration: const InputDecoration(labelText: 'Actual'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: unitCtrl,
                      decoration: const InputDecoration(labelText: 'Unit'),
                    ),
                  ),
                ]),
                TextField(
                  controller: deltaCtrl,
                  decoration: const InputDecoration(labelText: 'Delta (optional)'),
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
                    await client.post('/qhse-objectives', {
                      'category': category,
                      'label': labelCtrl.text.trim(),
                      'target': targetCtrl.text.trim(),
                      'actual': actualCtrl.text.trim(),
                      'unit': unitCtrl.text.trim(),
                      'status': status,
                      if (deltaCtrl.text.trim().isNotEmpty)
                        'delta': deltaCtrl.text.trim(),
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
}
