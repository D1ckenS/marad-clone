import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_client.dart';

class AdjustStockScreen extends StatefulWidget {
  final String partId;
  final String partName;
  final String? locationId;
  final String? locationName;

  const AdjustStockScreen({
    super.key,
    required this.partId,
    required this.partName,
    this.locationId,
    this.locationName,
  });

  @override
  State<AdjustStockScreen> createState() => _AdjustStockScreenState();
}

class _AdjustStockScreenState extends State<AdjustStockScreen> {
  final _formKey = GlobalKey<FormState>();
  final _qtyCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  String _movementType = 'ADJUSTMENT';
  String? _selectedLocationId;
  String? _selectedLocationName;
  List<_Location> _locations = [];
  bool _loadingLocations = false;
  bool _submitting = false;

  static const _movementTypes = ['ADJUSTMENT', 'RECEIPT', 'CONSUMPTION'];

  @override
  void initState() {
    super.initState();
    _selectedLocationId = widget.locationId;
    _selectedLocationName = widget.locationName;
    if (widget.locationId == null) _fetchLocations();
  }

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchLocations() async {
    setState(() => _loadingLocations = true);
    try {
      final client = context.read<ApiClient>();
      final data = await client.get('/stock-locations') as List<dynamic>;
      setState(() {
        _locations = data
            .map((l) => _Location.fromJson(l as Map<String, dynamic>))
            .toList();
      });
    } catch (_) {
      // Non-fatal: user can still type a location ID if the dropdown fails.
    } finally {
      if (mounted) setState(() => _loadingLocations = false);
    }
  }

  String? _nameForId(String? id) {
    if (id == null) return null;
    for (final loc in _locations) {
      if (loc.id == id) return loc.name;
    }
    return null;
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_selectedLocationId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a location')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final client = context.read<ApiClient>();
      await client.post('/stock-movements', {
        'partId': widget.partId,
        'locationId': _selectedLocationId,
        'movementType': _movementType,
        'quantity': _qtyCtrl.text.trim(),
        if (_notesCtrl.text.isNotEmpty) 'notes': _notesCtrl.text.trim(),
        'recordedAt': DateTime.now().toUtc().toIso8601String(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Stock updated'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: Colors.red),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.partName)),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    const Icon(Icons.inventory_2_outlined, color: Colors.blue),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(widget.partName,
                              style: const TextStyle(fontWeight: FontWeight.bold)),
                          Text(widget.partId,
                              style: const TextStyle(
                                  fontSize: 11, color: Colors.grey)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            // Movement type selector
            DropdownButtonFormField<String>(
              value: _movementType,
              decoration: const InputDecoration(
                labelText: 'Movement Type',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.swap_horiz),
              ),
              items: _movementTypes
                  .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                  .toList(),
              onChanged: (v) => setState(() => _movementType = v!),
            ),
            const SizedBox(height: 16),
            // Location selector or pre-filled
            if (widget.locationId != null)
              TextFormField(
                initialValue: widget.locationName ?? widget.locationId,
                decoration: const InputDecoration(
                  labelText: 'Location',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.place_outlined),
                ),
                readOnly: true,
              )
            else if (_loadingLocations)
              const Center(child: CircularProgressIndicator())
            else
              DropdownButtonFormField<String>(
                value: _selectedLocationId,
                decoration: const InputDecoration(
                  labelText: 'Location',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.place_outlined),
                ),
                hint: const Text('Select location'),
                items: _locations
                    .map((l) => DropdownMenuItem(value: l.id, child: Text(l.name)))
                    .toList(),
                onChanged: (v) {
                  setState(() {
                    _selectedLocationId = v;
                    _selectedLocationName = _nameForId(v);
                  });
                },
                validator: (v) => v == null ? 'Select a location' : null,
              ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _qtyCtrl,
              decoration: InputDecoration(
                labelText: 'Quantity',
                border: const OutlineInputBorder(),
                prefixIcon: const Icon(Icons.numbers),
                helperText: _movementType == 'ADJUSTMENT'
                    ? 'Use negative to reduce stock (e.g. -3)'
                    : _movementType == 'CONSUMPTION'
                        ? 'Enter amount consumed (use negative number)'
                        : 'Enter received quantity (positive)',
              ),
              keyboardType: const TextInputType.numberWithOptions(
                  signed: true, decimal: true),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Required';
                if (double.tryParse(v.trim()) == null) return 'Enter a valid number';
                return null;
              },
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _notesCtrl,
              decoration: const InputDecoration(
                labelText: 'Notes (optional)',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.notes),
              ),
              maxLines: 3,
            ),
            const SizedBox(height: 32),
            FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              icon: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.save_outlined),
              label: const Text('Save Stock Movement'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Location {
  final String id;
  final String name;
  const _Location(this.id, this.name);
  factory _Location.fromJson(Map<String, dynamic> j) =>
      _Location(j['id'] as String, j['name'] as String);
}
