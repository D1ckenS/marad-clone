import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/inventory_item.dart';
import '../services/api_client.dart';
import '../widgets/rob_status_chip.dart';
import 'adjust_stock_screen.dart';
import 'barcode_scan_screen.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});
  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  List<InventoryItem>? _items;
  String? _error;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = context.read<ApiClient>();
      final data = await client.get('/parts/inventory-summary') as List<dynamic>;
      setState(() {
        _items = data
            .map((e) => InventoryItem.fromJson(e as Map<String, dynamic>))
            .toList();
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'Could not reach vessel API.\n$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _scanBarcode() async {
    final result = await Navigator.of(context).push<BarcodeScanResult>(
      MaterialPageRoute(builder: (_) => const BarcodeScanScreen()),
    );
    if (result == null || !mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AdjustStockScreen(
          partId: result.partId,
          partName: result.partName,
        ),
      ),
    );
    _load();
  }

  void _openAdjust(InventoryItem item) {
    final firstLevel =
        item.stockLevels.isNotEmpty ? item.stockLevels.first : null;
    Navigator.of(context)
        .push(
          MaterialPageRoute(
            builder: (_) => AdjustStockScreen(
              partId: item.id,
              partName: item.name,
              locationId: firstLevel?.locationId,
              locationName: firstLevel?.locationName,
            ),
          ),
        )
        .then((_) => _load());
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _items == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off, size: 48, color: Colors.grey),
              const SizedBox(height: 12),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }
    final items = _items ?? [];
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: items.isEmpty
            ? ListView(
                children: const [
                  SizedBox(height: 120),
                  Center(child: Text('No parts in inventory.')),
                ],
              )
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (ctx, i) {
                  final item = items[i];
                  return Card(
                    child: ListTile(
                      leading: RobStatusChip(status: item.overallStatus),
                      title: Text(
                        item.name,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.partNumber,
                              style: const TextStyle(fontSize: 12)),
                          if (item.stockLevels.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Wrap(
                              spacing: 6,
                              children: item.stockLevels
                                  .map(
                                    (l) => Chip(
                                      label: Text(
                                        '${l.locationName}: ${l.rob.toStringAsFixed(1)}'
                                        '${item.unit != null ? ' ${item.unit}' : ''}',
                                        style: const TextStyle(fontSize: 11),
                                      ),
                                      padding: EdgeInsets.zero,
                                      visualDensity: VisualDensity.compact,
                                    ),
                                  )
                                  .toList(),
                            ),
                          ],
                        ],
                      ),
                      isThreeLine: item.stockLevels.isNotEmpty,
                      trailing: IconButton(
                        icon: const Icon(Icons.edit_outlined),
                        tooltip: 'Adjust stock',
                        onPressed: () => _openAdjust(item),
                      ),
                    ),
                  );
                },
              ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _scanBarcode,
        icon: const Icon(Icons.qr_code_scanner),
        label: const Text('Scan Barcode'),
      ),
    );
  }
}
