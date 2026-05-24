import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/purchase_order.dart';
import '../providers/auth_provider.dart';
import 'po_receive_screen.dart';

/// Lists open purchase orders so the field worker can pick one to receive
/// against. Closed/cancelled POs are filtered out — receiving is the only
/// action mobile supports.
class PurchaseOrdersScreen extends StatefulWidget {
  const PurchaseOrdersScreen({super.key});
  @override
  State<PurchaseOrdersScreen> createState() => _PurchaseOrdersScreenState();
}

class _PurchaseOrdersScreenState extends State<PurchaseOrdersScreen> {
  List<PurchaseOrder> _pos = [];
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
      final data = await client.get('/purchase-orders');
      setState(() {
        _pos = (data as List<dynamic>)
            .cast<Map<String, dynamic>>()
            .map(PurchaseOrder.fromJson)
            .where((po) => po.isReceivable)
            .toList();
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _statusLabel(String status) => switch (status) {
        'SENT' => 'purchase.status_sent'.tr(),
        'ACKNOWLEDGED' => 'purchase.status_acked'.tr(),
        'IN_TRANSIT' => 'purchase.status_in_transit'.tr(),
        'PARTIALLY_RECEIVED' => 'purchase.status_partial'.tr(),
        _ => status,
      };

  Color _statusColor(String status) => switch (status) {
        'PARTIALLY_RECEIVED' => const Color(0xFF1F5B9D),
        'IN_TRANSIT' => const Color(0xFFB5731E),
        _ => const Color(0xFF2F7D4F),
      };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('purchase.title'.tr())),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                : _pos.isEmpty
                    ? Center(child: Text('purchase.empty'.tr()))
                    : ListView.builder(
                        itemCount: _pos.length,
                        itemBuilder: (ctx, i) {
                          final po = _pos[i];
                          final color = _statusColor(po.status);
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            child: ListTile(
                              leading: const Icon(Icons.shopping_cart_outlined),
                              title: Text(
                                'purchase.po_label'.tr(namedArgs: {
                                  'number': po.number ?? po.id.substring(0, 8),
                                }),
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (po.supplierName != null)
                                    Text('purchase.supplier_label'.tr(namedArgs: {'name': po.supplierName!})),
                                  Text('purchase.lines_count'.tr(namedArgs: {'n': '${po.lines.length}'})),
                                ],
                              ),
                              trailing: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: color.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(_statusLabel(po.status),
                                    style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold)),
                              ),
                              isThreeLine: true,
                              onTap: () async {
                                final result = await Navigator.of(context).push<bool>(
                                  MaterialPageRoute(
                                    builder: (_) => PoReceiveScreen(po: po),
                                  ),
                                );
                                if (result == true) _load();
                              },
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
