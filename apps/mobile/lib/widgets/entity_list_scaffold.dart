import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';

/// Generic scaffold for "list + pull-to-refresh + FAB → create" screens.
/// Used by the 7 deferred-stub entity screens (DischargeLog, JHA, etc.) so
/// each one only owns its create dialog and its item-card builder.
class EntityListScaffold extends StatefulWidget {
  final String title;
  final String endpoint;
  final Widget Function(BuildContext ctx, Map<String, dynamic> item) itemBuilder;

  /// Shown when the user taps the FAB. Should return `true` when a new record
  /// was created so the list refreshes.
  final Future<bool?> Function(BuildContext ctx, ApiClient client, String? vesselId)
      onCreate;

  final String? emptyMessage;
  final String? createTooltip;

  const EntityListScaffold({
    super.key,
    required this.title,
    required this.endpoint,
    required this.itemBuilder,
    required this.onCreate,
    this.emptyMessage,
    this.createTooltip,
  });

  @override
  State<EntityListScaffold> createState() => _EntityListScaffoldState();
}

class _EntityListScaffoldState extends State<EntityListScaffold> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;

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
      final client = context.read<AuthProvider>().client;
      final data = await client.get(widget.endpoint);
      setState(() {
        _items = (data as List<dynamic>).cast<Map<String, dynamic>>();
      });
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openCreate() async {
    final auth = context.read<AuthProvider>();
    final created = await widget.onCreate(context, auth.client, auth.vesselId);
    if (created == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(_error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.red)),
                    ),
                  )
                : _items.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          SizedBox(
                            height: MediaQuery.of(context).size.height * 0.5,
                            child: Center(
                              child: Text(widget.emptyMessage ?? 'No records.'),
                            ),
                          ),
                        ],
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        itemCount: _items.length,
                        itemBuilder: (ctx, i) => widget.itemBuilder(ctx, _items[i]),
                      ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreate,
        icon: const Icon(Icons.add),
        label: Text(widget.createTooltip ?? 'Add'),
      ),
    );
  }
}

/// Small helper used by every entity create-dialog to surface validation
/// errors consistently. Returns true if the body was accepted (`onSubmit`
/// returned without throwing), false on failure.
Future<bool> submitCreateForm({
  required BuildContext sheetCtx,
  required Future<void> Function() onSubmit,
}) async {
  try {
    await onSubmit();
    return true;
  } on ApiException catch (e) {
    if (sheetCtx.mounted) {
      ScaffoldMessenger.of(sheetCtx).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: Colors.red),
      );
    }
    return false;
  } catch (e) {
    if (sheetCtx.mounted) {
      ScaffoldMessenger.of(sheetCtx).showSnackBar(
        SnackBar(content: Text('$e'), backgroundColor: Colors.red),
      );
    }
    return false;
  }
}
