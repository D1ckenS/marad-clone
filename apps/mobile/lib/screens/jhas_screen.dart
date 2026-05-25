import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../widgets/entity_list_scaffold.dart';

class JhasScreen extends StatelessWidget {
  const JhasScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return EntityListScaffold(
      title: 'jhas.title'.tr(),
      endpoint: '/jhas',
      createTooltip: 'jhas.create_button'.tr(),
      emptyMessage: 'jhas.empty'.tr(),
      itemBuilder: (ctx, item) {
        final residualL = item['residualL'];
        final residualS = item['residualS'];
        final residual = (residualL is num && residualS is num)
            ? '${residualL * residualS}'
            : '—';
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: ListTile(
            leading: const Icon(Icons.warning_amber_outlined, color: Color(0xFFB5731E)),
            title: Text('${item['ref']} · ${item['title']}',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(
              [
                if (item['activity'] != null) item['activity'].toString(),
                'Residual risk: $residual',
              ].join(' · '),
            ),
          ),
        );
      },
      onCreate: (ctx, client, vesselId) => _showCreateDialog(ctx, client),
    );
  }

  Future<bool?> _showCreateDialog(BuildContext ctx, ApiClient client) async {
    final refCtrl = TextEditingController();
    final titleCtrl = TextEditingController();
    final activityCtrl = TextEditingController();
    final hazardsCtrl = TextEditingController();
    final controlsCtrl = TextEditingController();
    int residualL = 1;
    int residualS = 1;

    return showDialog<bool>(
      context: ctx,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (stateCtx, setSt) => AlertDialog(
          title: Text('jhas.create_title'.tr()),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: refCtrl,
                  decoration: const InputDecoration(labelText: 'Reference (e.g. JHA-001)'),
                ),
                TextField(
                  controller: titleCtrl,
                  decoration: const InputDecoration(labelText: 'Title'),
                ),
                TextField(
                  controller: activityCtrl,
                  decoration: const InputDecoration(labelText: 'Activity (e.g. hot work in ER)'),
                ),
                TextField(
                  controller: hazardsCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Hazards (comma-separated)',
                  ),
                  maxLines: 2,
                ),
                TextField(
                  controller: controlsCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Controls (comma-separated)',
                  ),
                  maxLines: 2,
                ),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<int>(
                        initialValue: residualL,
                        decoration:
                            const InputDecoration(labelText: 'Residual L (1–5)'),
                        items: List.generate(
                          5,
                          (i) => DropdownMenuItem(value: i + 1, child: Text('${i + 1}')),
                        ),
                        onChanged: (v) => setSt(() => residualL = v!),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: DropdownButtonFormField<int>(
                        initialValue: residualS,
                        decoration:
                            const InputDecoration(labelText: 'Residual S (1–5)'),
                        items: List.generate(
                          5,
                          (i) => DropdownMenuItem(value: i + 1, child: Text('${i + 1}')),
                        ),
                        onChanged: (v) => setSt(() => residualS = v!),
                      ),
                    ),
                  ],
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
                final hazards = hazardsCtrl.text
                    .split(',')
                    .map((s) => s.trim())
                    .where((s) => s.isNotEmpty)
                    .toList();
                final controls = controlsCtrl.text
                    .split(',')
                    .map((s) => s.trim())
                    .where((s) => s.isNotEmpty)
                    .toList();
                final ok = await submitCreateForm(
                  sheetCtx: dialogCtx,
                  onSubmit: () async {
                    await client.post('/jhas', {
                      'ref': refCtrl.text.trim(),
                      'title': titleCtrl.text.trim(),
                      if (activityCtrl.text.trim().isNotEmpty)
                        'activity': activityCtrl.text.trim(),
                      'hazards': hazards,
                      'controls': controls,
                      'residualL': residualL,
                      'residualS': residualS,
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
