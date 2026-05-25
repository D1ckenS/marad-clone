import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/purchase_order.dart';
import '../services/api_client.dart';
import '../services/outbox_service.dart';
import 'barcode_scan_screen.dart';

/// One-screen GRN flow against an open PO.
///
/// Per line the user can enter "received now" (defaults to 0) and add notes
/// for discrepancies (short / over / damaged). Vessel
/// `POST /purchase-orders/:id/receive` accepts each line's actual quantity
/// independently of what was ordered, so partial/over/under receipts are all
/// expressed through this single shape — see ADR-implicit in
/// `apps/api-vessel/src/purchase-order/dto/receive-purchase-order.dto.ts`.
///
/// Barcode scan: scanning highlights the matching line (matched by part name
/// substring; partId would be cleaner but the barcode-bindings endpoint
/// returns partId, not poLineId). If no line matches the user sees a snackbar
/// — likely an unexpected delivery, which they can still log via notes.
class PoReceiveScreen extends StatefulWidget {
  final PurchaseOrder po;
  const PoReceiveScreen({super.key, required this.po});

  @override
  State<PoReceiveScreen> createState() => _PoReceiveScreenState();
}

class _PoReceiveScreenState extends State<PoReceiveScreen> {
  late final List<TextEditingController> _qtyCtrls;
  late final List<TextEditingController> _notesCtrls;
  String? _highlightedLineId;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _qtyCtrls = widget.po.lines.map((_) => TextEditingController(text: '0')).toList();
    _notesCtrls = widget.po.lines.map((_) => TextEditingController()).toList();
  }

  @override
  void dispose() {
    for (final c in _qtyCtrls) {
      c.dispose();
    }
    for (final c in _notesCtrls) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _scanBarcode() async {
    final result = await Navigator.of(context).push<BarcodeScanResult>(
      MaterialPageRoute(builder: (_) => const BarcodeScanScreen()),
    );
    if (result == null || !mounted) return;
    // Find a line whose partId matches the scanned part. If the PO line has
    // no partId (free-text description), fall back to a description substring
    // match.
    final matchIdx = widget.po.lines.indexWhere((l) {
      if (l.partId != null) return l.partId == result.partId;
      final d = (l.description ?? '').toLowerCase();
      return d.contains(result.partName.toLowerCase());
    });
    if (matchIdx < 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('purchase.barcode_no_match'.tr(namedArgs: {'value': result.partNumber}))),
      );
      return;
    }
    setState(() => _highlightedLineId = widget.po.lines[matchIdx].id);
  }

  Future<void> _submit() async {
    final entries = <Map<String, dynamic>>[];
    for (var i = 0; i < widget.po.lines.length; i++) {
      final qty = _qtyCtrls[i].text.trim();
      final qtyNum = double.tryParse(qty) ?? 0;
      if (qtyNum <= 0) continue; // skip "no receipt this round" lines
      entries.add({
        'poLineId': widget.po.lines[i].id,
        'quantityReceived': qty,
        if (_notesCtrls[i].text.trim().isNotEmpty)
          'notes': _notesCtrls[i].text.trim(),
      });
    }
    if (entries.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('purchase.nothing_to_receive'.tr())),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final outbox = context.read<OutboxService>();
      final result = await outbox.postOrQueue(
        '/purchase-orders/${widget.po.id}/receive',
        {'lines': entries},
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(
          result == null
              ? 'outbox.queued_offline'.tr()
              : 'purchase.receipt_submitted'.tr(),
        )),
      );
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: Colors.red),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final poLabel = 'purchase.po_label'.tr(namedArgs: {
      'number': widget.po.number ?? widget.po.id.substring(0, 8),
    });
    return Scaffold(
      appBar: AppBar(
        title: Text('purchase.receive_title'.tr(namedArgs: {'po': poLabel})),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner),
            tooltip: 'purchase.scan_to_select'.tr(),
            onPressed: _scanBarcode,
          ),
        ],
      ),
      body: widget.po.lines.isEmpty
          ? Center(child: Text('purchase.no_po_lines'.tr()))
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
              itemCount: widget.po.lines.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (ctx, i) {
                final line = widget.po.lines[i];
                final highlighted = line.id == _highlightedLineId;
                return Card(
                  color: highlighted ? const Color(0xFFFFF8E1) : null,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(line.description ?? line.partId ?? '—',
                            style: const TextStyle(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text(
                          'purchase.line_ordered'.tr(namedArgs: {
                            'qty': line.quantity,
                            'unit': line.unit,
                          }),
                          style: const TextStyle(fontSize: 12, color: Colors.grey),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _qtyCtrls[i],
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: InputDecoration(
                            labelText: 'purchase.line_receive_now'.tr(),
                            suffixText: line.unit,
                            border: const OutlineInputBorder(),
                            isDense: true,
                          ),
                        ),
                        const SizedBox(height: 6),
                        TextField(
                          controller: _notesCtrls[i],
                          decoration: InputDecoration(
                            labelText: 'purchase.line_notes'.tr(),
                            border: const OutlineInputBorder(),
                            isDense: true,
                          ),
                          maxLines: 2,
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.all(12),
        child: SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: _submitting ? null : _submit,
            icon: _submitting
                ? const SizedBox(
                    width: 16, height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.check),
            label: Text('purchase.submit_receipt'.tr()),
            style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
          ),
        ),
      ),
    );
  }
}
