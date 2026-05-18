import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class RestHoursScreen extends StatefulWidget {
  const RestHoursScreen({super.key});
  @override
  State<RestHoursScreen> createState() => _RestHoursScreenState();
}

class _RestHoursScreenState extends State<RestHoursScreen> {
  List<dynamic> _crew = [];
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
      final data = await client.get('/crew-members');
      setState(() { _crew = data as List<dynamic>; });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Crew Rest Hours')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                : _crew.isEmpty
                    ? const Center(child: Text('No crew members found.'))
                    : ListView.builder(
                        itemCount: _crew.length,
                        itemBuilder: (ctx, i) {
                          final m = _crew[i] as Map<String, dynamic>;
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: const Color(0xFF1F5B9D),
                              child: Text(
                                '${m['firstName']?.toString().substring(0, 1)}${m['lastName']?.toString().substring(0, 1)}',
                                style: const TextStyle(color: Colors.white, fontSize: 12),
                              ),
                            ),
                            title: Text('${m['firstName']} ${m['lastName']}',
                                style: const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: Text('${m['rank']} · ${m['status']}'),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => _showLogRestHoursDialog(context, m),
                          );
                        },
                      ),
      ),
    );
  }

  Future<void> _showLogRestHoursDialog(BuildContext ctx, Map<String, dynamic> member) async {
    final dateController = TextEditingController(
        text: DateTime.now().toIso8601String().split('T').first);
    final List<bool> workedHours = List.filled(24, false);

    await showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (sheetCtx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.85,
        builder: (_, ctrl) => StatefulBuilder(
          builder: (stateCtx, setSheetState) => Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(child: Text(
                      'Log Rest Hours — ${member['firstName']} ${member['lastName']}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    )),
                    IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(sheetCtx)),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: TextField(
                  controller: dateController,
                  decoration: const InputDecoration(labelText: 'Date (YYYY-MM-DD)', border: OutlineInputBorder()),
                ),
              ),
              const Padding(
                padding: EdgeInsets.all(12),
                child: Text('Mark hours worked (checked = worked, unchecked = resting):',
                    style: TextStyle(fontSize: 12, color: Colors.grey)),
              ),
              Expanded(
                child: GridView.builder(
                  controller: ctrl,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 6,
                    childAspectRatio: 1.2,
                    crossAxisSpacing: 4,
                    mainAxisSpacing: 4,
                  ),
                  itemCount: 24,
                  itemBuilder: (_, h) => GestureDetector(
                    onTap: () => setSheetState(() { workedHours[h] = !workedHours[h]; }),
                    child: Container(
                      decoration: BoxDecoration(
                        color: workedHours[h] ? const Color(0xFFB5731E).withOpacity(0.15) : const Color(0xFF2F7D4F).withOpacity(0.12),
                        border: Border.all(color: workedHours[h] ? const Color(0xFFB5731E) : const Color(0xFF2F7D4F)),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('${h.toString().padLeft(2, '0')}:00',
                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                          Text(workedHours[h] ? 'Work' : 'Rest',
                              style: TextStyle(fontSize: 9, color: workedHours[h] ? const Color(0xFFB5731E) : const Color(0xFF2F7D4F))),
                        ],
                      ),
                    ),
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
                        await ctx.read<AuthProvider>().client.post('/rest-hour-entries', {
                          'crewMemberId': member['id'],
                          'date': dateController.text,
                          'hoursWorkedJson': jsonEncode(workedHours),
                        });
                        if (sheetCtx.mounted) {
                          Navigator.pop(sheetCtx);
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            const SnackBar(content: Text('Rest hours logged successfully')),
                          );
                        }
                      } catch (e) {
                        if (sheetCtx.mounted) {
                          ScaffoldMessenger.of(sheetCtx).showSnackBar(
                            SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
                          );
                        }
                      }
                    },
                    child: const Text('Save Rest Hours'),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
