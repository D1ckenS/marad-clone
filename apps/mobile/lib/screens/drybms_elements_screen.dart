import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import '../services/outbox_service.dart';
import '../widgets/entity_list_scaffold.dart';

class DrybmsElementsScreen extends StatelessWidget {
  const DrybmsElementsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return EntityListScaffold(
      title: 'drybms_elements.title'.tr(),
      endpoint: '/drybms-elements',
      createTooltip: 'drybms_elements.create_button'.tr(),
      emptyMessage: 'drybms_elements.empty'.tr(),
      itemBuilder: (ctx, item) {
        final score = item['score'];
        final color = score is num
            ? (score >= 4
                ? const Color(0xFF2F7D4F)
                : score >= 3
                    ? const Color(0xFF1F5B9D)
                    : score >= 2
                        ? const Color(0xFFB5731E)
                        : const Color(0xFFAB382E))
            : Colors.grey;
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: color.withValues(alpha: 0.15),
              child: Text(
                score?.toString() ?? '?',
                style: TextStyle(color: color, fontWeight: FontWeight.bold),
              ),
            ),
            title: Text(item['name']?.toString() ?? '—',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(
              'Ch ${item['chapter']} · ${item['chapterTitle']}'
              '${item['stage'] != null ? ' · ${item['stage']}' : ''}',
            ),
          ),
        );
      },
      onCreate: (ctx, outbox, _, vesselId) => _showCreateDialog(ctx, outbox),
    );
  }

  Future<bool?> _showCreateDialog(BuildContext ctx, OutboxService outbox) async {
    final chapterCtrl = TextEditingController();
    final chapterTitleCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final stageCtrl = TextEditingController();
    final evidenceCtrl = TextEditingController();
    int score = 1;

    return showDialog<bool>(
      context: ctx,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (stateCtx, setSt) => AlertDialog(
          title: Text('drybms_elements.create_title'.tr()),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(children: [
                  Expanded(
                    flex: 1,
                    child: TextField(
                      controller: chapterCtrl,
                      decoration: const InputDecoration(labelText: 'Chapter'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: TextField(
                      controller: chapterTitleCtrl,
                      decoration:
                          const InputDecoration(labelText: 'Chapter title'),
                    ),
                  ),
                ]),
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Element name'),
                ),
                DropdownButtonFormField<int>(
                  initialValue: score,
                  decoration: const InputDecoration(labelText: 'Score (1–4)'),
                  items: List.generate(
                    4,
                    (i) =>
                        DropdownMenuItem(value: i + 1, child: Text('${i + 1}')),
                  ),
                  onChanged: (v) => setSt(() => score = v!),
                ),
                TextField(
                  controller: stageCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Stage (e.g. PLAN/DO/CHECK/ACT)'),
                ),
                TextField(
                  controller: evidenceCtrl,
                  decoration: const InputDecoration(labelText: 'Evidence'),
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
                    await outbox.postOrQueue('/drybms-elements', {
                      'chapter': chapterCtrl.text.trim(),
                      'chapterTitle': chapterTitleCtrl.text.trim(),
                      'name': nameCtrl.text.trim(),
                      'score': score,
                      if (stageCtrl.text.trim().isNotEmpty)
                        'stage': stageCtrl.text.trim(),
                      if (evidenceCtrl.text.trim().isNotEmpty)
                        'evidence': evidenceCtrl.text.trim(),
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
