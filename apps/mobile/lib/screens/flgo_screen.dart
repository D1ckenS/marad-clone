import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';

class FlgoScreen extends StatefulWidget {
  const FlgoScreen({super.key});
  @override
  State<FlgoScreen> createState() => _FlgoScreenState();
}

class _FlgoScreenState extends State<FlgoScreen> {
  List<dynamic> _tanks = [];
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
      final client = context.read<AuthProvider>().client;
      final data = await client.get('/tanks');
      setState(() { _tanks = data as List<dynamic>; });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('FLGO — Tanks & Soundings')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                : _tanks.isEmpty
                    ? const Center(child: Text('No tanks configured.'))
                    : ListView.builder(
                        itemCount: _tanks.length,
                        itemBuilder: (ctx, i) {
                          final t = _tanks[i] as Map<String, dynamic>;
                          final lastReading = (t['readings'] as List?)?.firstOrNull;
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            child: ListTile(
                              leading: const Icon(Icons.water_drop_outlined, color: Color(0xFF1F5B9D)),
                              title: Text(t['name']?.toString() ?? '—',
                                  style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Text(
                                '${t['tankType'] ?? ''}'
                                '${t['capacityM3'] != null ? ' · Cap: ${t['capacityM3']} m³' : ''}',
                              ),
                              trailing: lastReading != null
                                  ? Column(
                                      mainAxisSize: MainAxisSize.min,
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text('${lastReading['robMt']} MT',
                                            style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2F7D4F))),
                                        Text(lastReading['readingDate']?.toString() ?? '',
                                            style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                      ],
                                    )
                                  : const Text('No sounding', style: TextStyle(color: Colors.grey, fontSize: 12)),
                              onTap: () => _showLogSoundingDialog(context, t),
                            ),
                          );
                        },
                      ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showLogBdnDialog(context),
        icon: const Icon(Icons.local_shipping),
        label: const Text('Log BDN'),
      ),
    );
  }

  Future<void> _showLogSoundingDialog(BuildContext ctx, Map<String, dynamic> tank) async {
    final robController = TextEditingController();
    final dateController = TextEditingController(
        text: DateTime.now().toIso8601String().split('T').first);
    final result = await showDialog<bool>(
      context: ctx,
      builder: (dialogCtx) => AlertDialog(
        title: Text('Log Sounding — ${tank['name']}'),
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
          TextButton(onPressed: () => Navigator.pop(dialogCtx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              try {
                await context.read<AuthProvider>().client.post('/tank-readings', {
                  'tankId': tank['id'],
                  'vesselId': tank['vesselId'],
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
            child: const Text('Save'),
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
        title: const Text('Log Bunker Delivery Note'),
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
          TextButton(onPressed: () => Navigator.pop(dialogCtx), child: const Text('Cancel')),
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
                    const SnackBar(content: Text('BDN logged successfully')),
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
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }
}
