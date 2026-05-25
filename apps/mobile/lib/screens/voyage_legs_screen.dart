import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../widgets/entity_list_scaffold.dart';

class VoyageLegsScreen extends StatelessWidget {
  const VoyageLegsScreen({super.key});

  static const _modes = ['LADEN', 'BALLAST'];

  @override
  Widget build(BuildContext context) {
    return EntityListScaffold(
      title: 'Voyage Legs',
      endpoint: '/voyage-legs',
      createTooltip: 'Log Leg',
      emptyMessage: 'No voyage legs yet.',
      itemBuilder: (ctx, item) {
        final mode = item['mode']?.toString() ?? '';
        final modeColor = mode == 'LADEN'
            ? const Color(0xFF1F5B9D)
            : const Color(0xFF2F7D4F);
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: ListTile(
            leading: const Icon(Icons.directions_boat_outlined),
            title: Text(item['route']?.toString() ?? '—',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${item['nm']} nm · ${item['hours']} h · ${item['fuelTonnes']} t fuel'),
                Text(
                  '${_formatDate(item['departureAt'])} → ${_formatDate(item['arrivalAt'])}',
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ],
            ),
            isThreeLine: true,
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: modeColor.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(mode,
                  style: TextStyle(
                      color: modeColor,
                      fontSize: 11,
                      fontWeight: FontWeight.bold)),
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
    final routeCtrl = TextEditingController();
    final departureCtrl = TextEditingController(
        text: DateTime.now().subtract(const Duration(days: 1)).toUtc().toIso8601String());
    final arrivalCtrl =
        TextEditingController(text: DateTime.now().toUtc().toIso8601String());
    final nmCtrl = TextEditingController();
    final fuelCtrl = TextEditingController();
    final co2Ctrl = TextEditingController();
    final soxCtrl = TextEditingController();
    final noxCtrl = TextEditingController();
    final hoursCtrl = TextEditingController();
    final cargoCtrl = TextEditingController();
    String mode = 'LADEN';

    return showDialog<bool>(
      context: ctx,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (stateCtx, setSt) => AlertDialog(
          title: const Text('Log Voyage Leg'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: routeCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Route (e.g. ROT → SIN)'),
                ),
                TextField(
                    controller: departureCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Departure (ISO UTC)')),
                TextField(
                    controller: arrivalCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Arrival (ISO UTC)')),
                Row(children: [
                  Expanded(
                    child: TextField(
                      controller: nmCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Distance (nm)'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: hoursCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Hours'),
                    ),
                  ),
                ]),
                TextField(
                  controller: fuelCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Fuel (tonnes)'),
                ),
                Row(children: [
                  Expanded(
                    child: TextField(
                      controller: co2Ctrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'CO₂ (t)'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: soxCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'SOₓ (t)'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: noxCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'NOₓ (t)'),
                    ),
                  ),
                ]),
                DropdownButtonFormField<String>(
                  initialValue: mode,
                  decoration: const InputDecoration(labelText: 'Mode'),
                  items: _modes
                      .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                      .toList(),
                  onChanged: (v) => setSt(() => mode = v!),
                ),
                TextField(
                  controller: cargoCtrl,
                  decoration: const InputDecoration(labelText: 'Cargo (optional)'),
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
                    await client.post('/voyage-legs', {
                      'vesselId': vesselId,
                      'route': routeCtrl.text.trim(),
                      'departureAt': departureCtrl.text.trim(),
                      'arrivalAt': arrivalCtrl.text.trim(),
                      'nm': nmCtrl.text.trim(),
                      'fuelTonnes': fuelCtrl.text.trim(),
                      'co2Tonnes': co2Ctrl.text.trim(),
                      'soxTonnes': soxCtrl.text.trim(),
                      'noxTonnes': noxCtrl.text.trim(),
                      'hours': hoursCtrl.text.trim(),
                      'mode': mode,
                      if (cargoCtrl.text.trim().isNotEmpty)
                        'cargo': cargoCtrl.text.trim(),
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
