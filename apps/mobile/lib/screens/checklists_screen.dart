import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class ChecklistsScreen extends StatefulWidget {
  const ChecklistsScreen({super.key});
  @override
  State<ChecklistsScreen> createState() => _ChecklistsScreenState();
}

class _ChecklistsScreenState extends State<ChecklistsScreen> {
  List<dynamic> _checklists = [];
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
      final data = await client.get('/checklist-instances');
      setState(() { _checklists = data as List<dynamic>; });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  Color _statusColor(String status) =>
      status == 'COMPLETED' ? const Color(0xFF2F7D4F) : const Color(0xFFB5731E);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('QHSE Checklists')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                : _checklists.isEmpty
                    ? const Center(child: Text('No checklists found.'))
                    : ListView.builder(
                        itemCount: _checklists.length,
                        itemBuilder: (ctx, i) {
                          final cl = _checklists[i] as Map<String, dynamic>;
                          final status = cl['status']?.toString() ?? 'IN_PROGRESS';
                          final color = _statusColor(status);
                          final responses = jsonDecode(cl['responsesJson']?.toString() ?? '[]') as List<dynamic>;
                          final signed = responses.where((r) => (r as Map<String, dynamic>)['checked'] == true).length;
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            child: ListTile(
                              leading: const Icon(Icons.checklist_outlined),
                              title: Text(cl['title']?.toString() ?? 'Checklist',
                                  style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Text('$signed/${responses.length} items checked'),
                              trailing: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: color.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(status == 'COMPLETED' ? 'Done' : 'In Progress',
                                    style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold)),
                              ),
                              onTap: status != 'COMPLETED'
                                  ? () => _openChecklist(context, cl)
                                  : null,
                            ),
                          );
                        },
                      ),
      ),
    );
  }

  Future<void> _openChecklist(BuildContext ctx, Map<String, dynamic> cl) async {
    final responses = List<Map<String, dynamic>>.from(
      (jsonDecode(cl['responsesJson']?.toString() ?? '[]') as List<dynamic>)
          .map((r) => Map<String, dynamic>.from(r as Map)),
    );

    await showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (sheetCtx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        builder: (_, ctrl) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(child: Text(cl['title']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16))),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(sheetCtx)),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: StatefulBuilder(
                builder: (stateCtx, setSheetState) => ListView.builder(
                  controller: ctrl,
                  itemCount: responses.length,
                  itemBuilder: (_, j) {
                    final item = responses[j];
                    return CheckboxListTile(
                      value: item['checked'] == true,
                      onChanged: item['signedAt'] != null ? null : (val) {
                        setSheetState(() { item['checked'] = val ?? false; });
                      },
                      title: Text(item['text']?.toString() ?? 'Item ${j + 1}'),
                      subtitle: item['signedAt'] != null
                          ? Text('Signed ${item['signedAt']}', style: const TextStyle(fontSize: 11))
                          : null,
                    );
                  },
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () async {
                    try {
                      final client = ctx.read<AuthProvider>().client;
                      // Sign each checked item
                      for (final item in responses.where((r) => r['checked'] == true && r['signedAt'] == null)) {
                        await client.post('/checklist-instances/${cl['id']}/sign-item', {
                          'itemId': item['itemId'],
                          'checked': true,
                        });
                      }
                      if (sheetCtx.mounted) Navigator.pop(sheetCtx);
                      _load();
                    } catch (e) {
                      if (sheetCtx.mounted) {
                        ScaffoldMessenger.of(sheetCtx).showSnackBar(
                          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
                        );
                      }
                    }
                  },
                  child: const Text('Save Progress'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
