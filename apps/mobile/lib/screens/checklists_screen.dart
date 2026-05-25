import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/checklist_instance.dart';
import '../providers/auth_provider.dart';
import '../utils/request_bodies.dart';

class ChecklistsScreen extends StatefulWidget {
  const ChecklistsScreen({super.key});
  @override
  State<ChecklistsScreen> createState() => _ChecklistsScreenState();
}

class _ChecklistsScreenState extends State<ChecklistsScreen> {
  List<ChecklistInstance> _checklists = [];
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
      setState(() {
        _checklists = (data as List<dynamic>)
            .cast<Map<String, dynamic>>()
            .map(ChecklistInstance.fromJson)
            .toList();
      });
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
                          final cl = _checklists[i];
                          final color = _statusColor(cl.status);
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            child: ListTile(
                              leading: const Icon(Icons.checklist_outlined),
                              title: Text(cl.title.isEmpty ? 'Checklist' : cl.title,
                                  style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Text('${cl.signedCount}/${cl.responses.length} items checked'),
                              trailing: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: color.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(cl.isCompleted ? 'Done' : 'In Progress',
                                    style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold)),
                              ),
                              onTap: cl.isCompleted ? null : () => _openChecklist(context, cl),
                            ),
                          );
                        },
                      ),
      ),
    );
  }

  Future<void> _openChecklist(BuildContext ctx, ChecklistInstance cl) async {
    // Working copy of the response list — local check-state lives here so
    // the user can toggle without persisting until Save. Each entry is
    // {itemId, label, checked} for the sheet's UI.
    final working = cl.responses
        .map((r) => {
              'itemId': r.itemId,
              'label': r.label ?? '',
              'checked': r.checked,
              'signedAt': r.signedAt,
            })
        .toList();

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
                  Expanded(child: Text(cl.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16))),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(sheetCtx)),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: StatefulBuilder(
                builder: (stateCtx, setSheetState) => ListView.builder(
                  controller: ctrl,
                  itemCount: working.length,
                  itemBuilder: (_, j) {
                    final item = working[j];
                    return CheckboxListTile(
                      value: item['checked'] == true,
                      onChanged: item['signedAt'] != null ? null : (val) {
                        setSheetState(() { item['checked'] = val ?? false; });
                      },
                      title: Text((item['label'] as String).isEmpty ? 'Item ${j + 1}' : item['label'] as String),
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
                      final auth = ctx.read<AuthProvider>();
                      final signedByUserId = auth.userId;
                      if (signedByUserId == null) {
                        ScaffoldMessenger.of(sheetCtx).showSnackBar(
                          const SnackBar(
                            content: Text('Cannot sign: no user id in session token.'),
                            backgroundColor: Colors.red,
                          ),
                        );
                        return;
                      }
                      final now = DateTime.now();
                      // Sign each newly-checked item (skip already-signed).
                      final newlyChecked = working.where((r) =>
                          r['checked'] == true && r['signedAt'] == null);
                      for (final item in newlyChecked) {
                        await auth.client.post(
                          '/checklist-instances/${cl.id}/sign-item',
                          buildSignChecklistItemBody(
                            itemId: item['itemId'] as String,
                            signedByUserId: signedByUserId,
                            signedAt: now,
                          ),
                        );
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
