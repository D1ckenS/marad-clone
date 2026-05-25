import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/outbox_service.dart';

/// AppBar action that surfaces the offline-outbox state:
///   - hidden when there are 0 pending writes (clean inbox UX),
///   - badge with pending count when writes are queued,
///   - red dot when there are permanently-failed writes,
///   - tap → bottom sheet listing entries with Retry / Discard actions.
class SyncStatusBadge extends StatefulWidget {
  const SyncStatusBadge({super.key});

  @override
  State<SyncStatusBadge> createState() => _SyncStatusBadgeState();
}

class _SyncStatusBadgeState extends State<SyncStatusBadge> {
  int _pending = 0;
  int _failed = 0;

  @override
  void initState() {
    super.initState();
    final outbox = context.read<OutboxService>();
    _refresh();
    outbox.addListener(_refresh);
  }

  @override
  void dispose() {
    context.read<OutboxService>().removeListener(_refresh);
    super.dispose();
  }

  Future<void> _refresh() async {
    final outbox = context.read<OutboxService>();
    final p = await outbox.pendingCount();
    final f = await outbox.failedCount();
    if (mounted) setState(() { _pending = p; _failed = f; });
  }

  @override
  Widget build(BuildContext context) {
    if (_pending == 0 && _failed == 0) return const SizedBox.shrink();
    final color = _failed > 0 ? const Color(0xFFAB382E) : const Color(0xFFB5731E);
    return IconButton(
      tooltip: 'outbox.tooltip'.tr(namedArgs: {
        'pending': '$_pending',
        'failed': '$_failed',
      }),
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          const Icon(Icons.cloud_off_outlined),
          Positioned(
            right: -6,
            top: -6,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(8),
              ),
              constraints: const BoxConstraints(minWidth: 16),
              child: Text(
                '${_pending + _failed}',
                style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ],
      ),
      onPressed: _openSheet,
    );
  }

  Future<void> _openSheet() async {
    final outbox = context.read<OutboxService>();
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (sheetCtx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        builder: (_, scrollCtrl) => FutureBuilder<List<OutboxEntry>>(
          future: outbox.listOpen(),
          builder: (ctx, snap) {
            final entries = snap.data ?? const <OutboxEntry>[];
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Expanded(child: Text('outbox.title'.tr(),
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16))),
                      TextButton.icon(
                        onPressed: () async {
                          await outbox.drainNow();
                          if (sheetCtx.mounted) Navigator.pop(sheetCtx);
                        },
                        icon: const Icon(Icons.sync, size: 16),
                        label: Text('outbox.sync_now'.tr()),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(sheetCtx),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Expanded(
                  child: entries.isEmpty
                      ? Center(child: Text('outbox.empty'.tr()))
                      : ListView.builder(
                          controller: scrollCtrl,
                          itemCount: entries.length,
                          itemBuilder: (_, i) {
                            final e = entries[i];
                            final isFailed = e.status == OutboxStatus.failed;
                            return ListTile(
                              leading: Icon(
                                isFailed ? Icons.error_outline : Icons.cloud_upload_outlined,
                                color: isFailed
                                    ? const Color(0xFFAB382E)
                                    : const Color(0xFFB5731E),
                              ),
                              title: Text('${e.method} ${e.path}',
                                  style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
                              subtitle: Text(
                                'outbox.entry_line'.tr(namedArgs: {
                                  'attempts': '${e.attempts}',
                                  'when': e.createdAt.split('.').first,
                                }) + (e.lastError != null ? '\n${e.lastError}' : ''),
                                style: const TextStyle(fontSize: 11),
                              ),
                              isThreeLine: e.lastError != null,
                              trailing: isFailed
                                  ? Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        IconButton(
                                          icon: const Icon(Icons.refresh, size: 18),
                                          tooltip: 'outbox.retry'.tr(),
                                          onPressed: () => outbox.retry(e.id),
                                        ),
                                        IconButton(
                                          icon: const Icon(Icons.delete_outline, size: 18),
                                          tooltip: 'outbox.discard'.tr(),
                                          onPressed: () => outbox.discard(e.id),
                                        ),
                                      ],
                                    )
                                  : null,
                            );
                          },
                        ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
