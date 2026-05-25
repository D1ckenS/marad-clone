import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/tank.dart';
import '../providers/auth_provider.dart';

class FlgoScreen extends StatefulWidget {
  const FlgoScreen({super.key});
  @override
  State<FlgoScreen> createState() => _FlgoScreenState();
}

class _FlgoScreenState extends State<FlgoScreen> {
  List<Tank> _tanks = [];
  /// Latest reading per tankId. Vessel `/tanks` doesn't return nested
  /// readings, so we fetch `/tank-readings` separately (sorted DESC by date)
  /// and take the first hit per tank.
  Map<String, TankReading> _latestReadingByTank = {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final auth = context.read<AuthProvider>();
      final client = auth.client;
      final tankData = await client.get('/tanks');
      final tanks = (tankData as List<dynamic>)
          .cast<Map<String, dynamic>>()
          .map(Tank.fromJson)
          .toList();

      final readingsUrl = auth.vesselId != null
          ? '/tank-readings?vesselId=${auth.vesselId}'
          : '/tank-readings';
      final readingData = await client.get(readingsUrl);
      final readings = (readingData as List<dynamic>)
          .cast<Map<String, dynamic>>()
          .map(TankReading.fromJson);
      // Readings come back sorted DESC by readingDate, so the first per
      // tankId is the latest.
      final latestByTank = <String, TankReading>{};
      for (final r in readings) {
        latestByTank.putIfAbsent(r.tankId, () => r);
      }

      setState(() {
        _tanks = tanks;
        _latestReadingByTank = latestByTank;
      });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('flgo.title'.tr())),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                : _tanks.isEmpty
                    ? Center(child: Text('flgo.empty'.tr()))
                    : ListView.builder(
                        itemCount: _tanks.length,
                        itemBuilder: (ctx, i) {
                          final t = _tanks[i];
                          final lastReading = _latestReadingByTank[t.id];
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            child: ListTile(
                              leading: const Icon(Icons.water_drop_outlined, color: Color(0xFF1F5B9D)),
                              title: Text(t.name,
                                  style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Text(
                                '${t.tankType ?? ''}'
                                '${t.capacityM3 != null ? ' · Cap: ${t.capacityM3} m³' : ''}',
                              ),
                              trailing: lastReading != null
                                  ? Column(
                                      mainAxisSize: MainAxisSize.min,
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text('flgo.rob_mt'.tr(namedArgs: {'n': lastReading.robMt}),
                                            style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2F7D4F))),
                                        Text(lastReading.readingDate,
                                            style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                      ],
                                    )
                                  : Text('flgo.no_sounding'.tr(), style: const TextStyle(color: Colors.grey, fontSize: 12)),
                              onTap: () => _showLogSoundingDialog(context, t),
                            ),
                          );
                        },
                      ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showLogBdnDialog(context),
        icon: const Icon(Icons.local_shipping),
        label: Text('flgo.log_bdn_button'.tr()),
      ),
    );
  }

  Future<void> _showLogSoundingDialog(BuildContext ctx, Tank tank) async {
    final robController = TextEditingController();
    final dateController = TextEditingController(
        text: DateTime.now().toIso8601String().split('T').first);
    final result = await showDialog<bool>(
      context: ctx,
      builder: (dialogCtx) => AlertDialog(
        title: Text('flgo.log_sounding_title'.tr(namedArgs: {'tank': tank.name})),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: dateController,
              decoration: const InputDecoration(labelText: 'Date (YYYY-MM-DD)'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: robController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'ROB (MT)'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogCtx, false), child: Text('common.cancel'.tr())),
          FilledButton(
            onPressed: () async {
              try {
                await context.read<AuthProvider>().client.post('/tank-readings', {
                  'tankId': tank.id,
                  'vesselId': tank.vesselId,
                  'readingDate': dateController.text,
                  'robMt': robController.text,
                });
                if (dialogCtx.mounted) Navigator.pop(dialogCtx, true);
              } catch (e) {
                if (dialogCtx.mounted) {
                  ScaffoldMessenger.of(dialogCtx).showSnackBar(
                    SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
                  );
                }
              }
            },
            child: Text('common.save'.tr()),
          ),
        ],
      ),
    );
    if (result == true) _load();
  }

  Future<void> _showLogBdnDialog(BuildContext ctx) async {
    final qtyController = TextEditingController();
    final dateController = TextEditingController(
        text: DateTime.now().toIso8601String().split('T').first);
    final supplierController = TextEditingController();
    await showDialog<void>(
      context: ctx,
      builder: (dialogCtx) => AlertDialog(
        title: Text('flgo.log_bdn_title'.tr()),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: dateController,
                decoration: const InputDecoration(labelText: 'Delivery Date')),
            const SizedBox(height: 8),
            TextField(controller: supplierController,
                decoration: const InputDecoration(labelText: 'Supplier Name')),
            const SizedBox(height: 8),
            TextField(
              controller: qtyController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Quantity (MT)'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogCtx), child: Text('common.cancel'.tr())),
          FilledButton(
            onPressed: () async {
              try {
                final auth = context.read<AuthProvider>();
                await auth.client.post('/bunker-delivery-notes', {
                  'vesselId': auth.vesselId,
                  'deliveryDate': dateController.text,
                  'supplierName': supplierController.text,
                  'quantityMt': qtyController.text,
                });
                if (dialogCtx.mounted) {
                  Navigator.pop(dialogCtx);
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    SnackBar(content: Text('flgo.bdn_logged'.tr())),
                  );
                }
              } catch (e) {
                if (dialogCtx.mounted) {
                  ScaffoldMessenger.of(dialogCtx).showSnackBar(
                    SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
                  );
                }
              }
            },
            child: Text('common.save'.tr()),
          ),
        ],
      ),
    );
  }
}
