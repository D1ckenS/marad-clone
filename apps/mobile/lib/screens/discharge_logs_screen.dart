import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import '../services/outbox_service.dart';
import '../widgets/entity_list_scaffold.dart';

class DischargeLogsScreen extends StatelessWidget {
  const DischargeLogsScreen({super.key});

  // MARPOL discharge categories — see Annex I/IV/V.
  static const _kinds = ['OIL', 'BILGE', 'SEWAGE', 'GARBAGE', 'BALLAST', 'OTHER'];

  @override
  Widget build(BuildContext context) {
    return EntityListScaffold(
      title: 'discharge_logs.title'.tr(),
      endpoint: '/discharge-logs',
      createTooltip: 'discharge_logs.create_button'.tr(),
      emptyMessage: 'discharge_logs.empty'.tr(),
      itemBuilder: (ctx, item) {
        final compliant = item['compliant'] as bool?;
        final color = compliant == false
            ? const Color(0xFFAB382E)
            : compliant == true
                ? const Color(0xFF2F7D4F)
                : Colors.grey;
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: ListTile(
            leading: Icon(Icons.water_outlined, color: color),
            title: Text('${item['kind']} · ${item['volume']}',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${item['location']}'),
                Text(_formatDate(item['occurredAt']),
                    style: const TextStyle(fontSize: 12, color: Colors.grey)),
              ],
            ),
            trailing: compliant == false
                ? const Icon(Icons.warning_amber_rounded, color: Color(0xFFAB382E))
                : null,
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
    if (vesselId == null) {
      ScaffoldMessenger.of(ctx).showSnackBar(
        SnackBar(content: Text('common.vessel_context_missing'.tr())),
      );
      return false;
    }
    String kind = _kinds.first;
    final dateCtrl = TextEditingController(
        text: DateTime.now().toUtc().toIso8601String());
    final locCtrl = TextEditingController();
    final volCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    bool compliant = true;

    return showDialog<bool>(
      context: ctx,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (stateCtx, setSt) => AlertDialog(
          title: Text('discharge_logs.create_title'.tr()),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: kind,
                  decoration: const InputDecoration(labelText: 'Kind'),
                  items: _kinds
                      .map((k) => DropdownMenuItem(value: k, child: Text(k)))
                      .toList(),
                  onChanged: (v) => setSt(() => kind = v!),
                ),
                TextField(
                  controller: dateCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Occurred at (ISO-8601 UTC)'),
                ),
                TextField(
                  controller: locCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Location (port / lat-lon)'),
                ),
                TextField(
                  controller: volCtrl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration:
                      const InputDecoration(labelText: 'Volume (m³ or kg)'),
                ),
                TextField(
                  controller: notesCtrl,
                  decoration: const InputDecoration(labelText: 'Notes'),
                  maxLines: 2,
                ),
                SwitchListTile(
                  value: compliant,
                  onChanged: (v) => setSt(() => compliant = v),
                  title: const Text('Compliant'),
                  contentPadding: EdgeInsets.zero,
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
                    await outbox.postOrQueue('/discharge-logs', {
                      'vesselId': vesselId,
                      'kind': kind,
                      'occurredAt': dateCtrl.text.trim(),
                      'location': locCtrl.text.trim(),
                      'volume': volCtrl.text.trim(),
                      if (notesCtrl.text.trim().isNotEmpty)
                        'notes': notesCtrl.text.trim(),
                      'compliant': compliant,
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
    return d == null ? v.toString() : d.toLocal().toString().split('.').first;
  }
}
