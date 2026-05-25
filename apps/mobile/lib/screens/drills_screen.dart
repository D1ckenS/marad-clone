import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/drill.dart';
import '../providers/auth_provider.dart';

class DrillsScreen extends StatefulWidget {
  const DrillsScreen({super.key});
  @override
  State<DrillsScreen> createState() => _DrillsScreenState();
}

class _DrillsScreenState extends State<DrillsScreen> {
  List<Drill> _drills = [];
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
      final data = await client.get('/drills');
      setState(() {
        _drills = (data as List<dynamic>)
            .cast<Map<String, dynamic>>()
            .map(Drill.fromJson)
            .toList();
      });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  Color _statusColor(String status) => switch (status) {
    'COMPLETED' => const Color(0xFF2F7D4F),
    'CANCELLED' => const Color(0xFFAB382E),
    _ => const Color(0xFFB5731E),
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('drills.title'.tr())),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                : _drills.isEmpty
                    ? Center(child: Text('drills.empty'.tr()))
                    : ListView.builder(
                        itemCount: _drills.length,
                        itemBuilder: (ctx, i) {
                          final d = _drills[i];
                          final color = _statusColor(d.status);
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            child: ListTile(
                              leading: const Icon(Icons.local_fire_department_outlined),
                              title: Text(
                                d.drillTypeName,
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(d.scheduledAt?.toLocal().toString().split(' ').first ?? ''),
                                  if (d.location != null) Text(d.location!),
                                ],
                              ),
                              trailing: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: color.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(d.status,
                                    style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold)),
                              ),
                              onTap: d.isScheduled
                                  ? () => _showSignOffDialog(context, d)
                                  : null,
                            ),
                          );
                        },
                      ),
      ),
    );
  }

  Future<void> _showSignOffDialog(BuildContext ctx, Drill drill) async {
    final nameController = TextEditingController();
    final result = await showDialog<bool>(
      context: ctx,
      builder: (dialogCtx) => AlertDialog(
        title: Text('drills.sign_title'.tr()),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('${'drills.drill_label'.tr()}: ${drill.drillTypeName}'),
            const SizedBox(height: 12),
            TextField(
              controller: nameController,
              decoration: InputDecoration(labelText: 'drills.your_name'.tr()),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogCtx, false), child: Text('common.cancel'.tr())),
          FilledButton(
            onPressed: () async {
              try {
                await context.read<AuthProvider>().client.post(
                  '/drills/${drill.id}/records',
                  {
                    'participantName': nameController.text,
                    'signedAt': DateTime.now().toIso8601String(),
                  },
                );
                if (dialogCtx.mounted) Navigator.pop(dialogCtx, true);
              } catch (e) {
                if (dialogCtx.mounted) {
                  ScaffoldMessenger.of(dialogCtx).showSnackBar(
                    SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
                  );
                }
              }
            },
            child: Text('drills.sign_button'.tr()),
          ),
        ],
      ),
    );
    if (result == true) {
      if (ctx.mounted) {
        ScaffoldMessenger.of(ctx).showSnackBar(
          SnackBar(content: Text('drills.record_added'.tr())),
        );
      }
      _load();
    }
  }
}
