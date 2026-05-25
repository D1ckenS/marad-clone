import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

import 'api_client.dart';

/// Status of a queued write.
enum OutboxStatus { pending, sent, failed }

/// One queued write that the device couldn't deliver online.
@immutable
class OutboxEntry {
  final int id;
  final String method; // POST | PATCH | DELETE | MULTIPART_POST
  final String path;
  final String bodyJson;
  final int attempts;
  final String? lastError;
  final String createdAt; // ISO-8601 UTC
  final String? sentAt;
  final OutboxStatus status;

  const OutboxEntry({
    required this.id,
    required this.method,
    required this.path,
    required this.bodyJson,
    required this.attempts,
    required this.createdAt,
    this.lastError,
    this.sentAt,
    required this.status,
  });

  factory OutboxEntry.fromRow(Map<String, Object?> row) => OutboxEntry(
        id: row['id'] as int,
        method: row['method'] as String,
        path: row['path'] as String,
        bodyJson: row['body_json'] as String,
        attempts: row['attempts'] as int,
        lastError: row['last_error'] as String?,
        createdAt: row['created_at'] as String,
        sentAt: row['sent_at'] as String?,
        status: OutboxStatus.values.byName(row['status'] as String),
      );

  Map<String, dynamic> get body =>
      jsonDecode(bodyJson) as Map<String, dynamic>;
}

/// Wraps [ApiClient] so that POST/PATCH writes that fail due to network
/// problems are queued locally and re-attempted later. Implements the spec
/// requirement from REFERENCE.md §9.10: "Works fully offline against local
/// vessel API over ship Wi-Fi; queues writes if unreachable."
///
/// Conflict semantics: last-write-wins, ordered by created_at. The vessel
/// API is the authority — if the queued write fails with a 4xx, we mark
/// it `failed` so the user sees the error rather than silently retrying
/// forever. Network errors (5xx, connection refused, timeout) keep retrying
/// with exponential backoff in [drain].
class OutboxService extends ChangeNotifier {
  static const _maxAttempts = 12;

  final ApiClient _client;
  Database? _db;
  Timer? _drainTimer;
  bool _draining = false;

  OutboxService(this._client);

  /// Initialise: open the SQLite database and start the periodic drain loop.
  /// Call from main() after WidgetsFlutterBinding.ensureInitialized.
  Future<void> init() async {
    final dir = await getApplicationSupportDirectory();
    final path = p.join(dir.path, 'fleetops_outbox.db');
    _db = await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE outbox (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            method TEXT NOT NULL,
            path TEXT NOT NULL,
            body_json TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            created_at TEXT NOT NULL,
            sent_at TEXT,
            status TEXT NOT NULL DEFAULT 'pending'
          )
        ''');
        await db.execute('CREATE INDEX outbox_status_idx ON outbox(status)');
      },
    );
    _startDrainTimer();
  }

  /// Returns the count of entries currently pending (not yet sent and not
  /// permanently failed).
  Future<int> pendingCount() async {
    final db = _db;
    if (db == null) return 0;
    final rows = await db.rawQuery(
      "SELECT COUNT(*) AS n FROM outbox WHERE status = 'pending'",
    );
    return (rows.first['n'] as int?) ?? 0;
  }

  /// Returns the count of entries that failed permanently (4xx errors).
  Future<int> failedCount() async {
    final db = _db;
    if (db == null) return 0;
    final rows = await db.rawQuery(
      "SELECT COUNT(*) AS n FROM outbox WHERE status = 'failed'",
    );
    return (rows.first['n'] as int?) ?? 0;
  }

  /// Lists all non-sent entries, newest first. Useful for a debug screen.
  Future<List<OutboxEntry>> listOpen() async {
    final db = _db;
    if (db == null) return const [];
    final rows = await db.rawQuery(
      "SELECT * FROM outbox WHERE status != 'sent' ORDER BY created_at DESC",
    );
    return rows.map(OutboxEntry.fromRow).toList();
  }

  /// Try to deliver a write online first. If the network fails, persist it
  /// to the outbox for later retry. Returns the parsed response on immediate
  /// success, or `null` if the write was queued for later.
  Future<dynamic> postOrQueue(String path, Map<String, dynamic> body) async {
    return _writeOrQueue('POST', path, body);
  }

  Future<dynamic> patchOrQueue(String path, Map<String, dynamic> body) async {
    return _writeOrQueue('PATCH', path, body);
  }

  Future<dynamic> _writeOrQueue(
      String method, String path, Map<String, dynamic> body) async {
    try {
      switch (method) {
        case 'POST':
          return await _client.post(path, body);
        case 'PATCH':
          return await _client.patch(path, body);
        default:
          throw StateError('Unsupported method: $method');
      }
    } on SocketException catch (e) {
      await _enqueue(method, path, body, lastError: e.message);
      notifyListeners();
      return null;
    } on TimeoutException catch (e) {
      await _enqueue(method, path, body, lastError: '${e.message}');
      notifyListeners();
      return null;
    } on ApiException catch (e) {
      // 5xx → network-ish, queue. 4xx → don't queue; surface to caller.
      if (e.statusCode >= 500) {
        await _enqueue(method, path, body, lastError: e.message);
        notifyListeners();
        return null;
      }
      rethrow;
    }
  }

  /// Manually trigger a drain (e.g. when the user taps "Sync now").
  Future<void> drainNow() => _drain();

  Future<void> _enqueue(
    String method,
    String path,
    Map<String, dynamic> body, {
    String? lastError,
  }) async {
    final db = _db;
    if (db == null) throw StateError('OutboxService not initialised');
    await db.insert('outbox', {
      'method': method,
      'path': path,
      'body_json': jsonEncode(body),
      'attempts': 0,
      'last_error': lastError,
      'created_at': DateTime.now().toUtc().toIso8601String(),
      'status': OutboxStatus.pending.name,
    });
  }

  void _startDrainTimer() {
    _drainTimer?.cancel();
    _drainTimer = Timer.periodic(
        const Duration(seconds: 30), (_) => _drain());
  }

  Future<void> _drain() async {
    if (_draining) return;
    final db = _db;
    if (db == null) return;
    _draining = true;
    try {
      final rows = await db.rawQuery(
        "SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at ASC LIMIT 25",
      );
      var changed = false;
      for (final row in rows) {
        final entry = OutboxEntry.fromRow(row);
        if (entry.attempts >= _maxAttempts) {
          await db.update(
            'outbox',
            {
              'status': OutboxStatus.failed.name,
              'last_error': 'gave up after $_maxAttempts attempts',
            },
            where: 'id = ?',
            whereArgs: [entry.id],
          );
          changed = true;
          continue;
        }
        try {
          switch (entry.method) {
            case 'POST':
              await _client.post(entry.path, entry.body);
              break;
            case 'PATCH':
              await _client.patch(entry.path, entry.body);
              break;
            default:
              throw StateError('Unsupported queued method: ${entry.method}');
          }
          await db.update(
            'outbox',
            {
              'status': OutboxStatus.sent.name,
              'sent_at': DateTime.now().toUtc().toIso8601String(),
            },
            where: 'id = ?',
            whereArgs: [entry.id],
          );
          changed = true;
        } on SocketException catch (e) {
          await db.update(
            'outbox',
            {
              'attempts': entry.attempts + 1,
              'last_error': e.message,
            },
            where: 'id = ?',
            whereArgs: [entry.id],
          );
          // Stop draining — vessel API is unreachable.
          break;
        } on ApiException catch (e) {
          if (e.statusCode >= 500) {
            await db.update(
              'outbox',
              {
                'attempts': entry.attempts + 1,
                'last_error': e.message,
              },
              where: 'id = ?',
              whereArgs: [entry.id],
            );
          } else {
            // 4xx — permanent failure. Don't retry.
            await db.update(
              'outbox',
              {
                'status': OutboxStatus.failed.name,
                'attempts': entry.attempts + 1,
                'last_error': '${e.statusCode}: ${e.message}',
              },
              where: 'id = ?',
              whereArgs: [entry.id],
            );
            changed = true;
          }
        } catch (e) {
          await db.update(
            'outbox',
            {
              'attempts': entry.attempts + 1,
              'last_error': e.toString(),
            },
            where: 'id = ?',
            whereArgs: [entry.id],
          );
        }
      }
      if (changed) notifyListeners();
    } finally {
      _draining = false;
    }
  }

  /// Remove a failed entry (after user acknowledges the error).
  Future<void> discard(int id) async {
    final db = _db;
    if (db == null) return;
    await db.delete('outbox', where: 'id = ?', whereArgs: [id]);
    notifyListeners();
  }

  /// Move a failed entry back to pending so the drain loop retries it.
  Future<void> retry(int id) async {
    final db = _db;
    if (db == null) return;
    await db.update(
      'outbox',
      {
        'status': OutboxStatus.pending.name,
        'attempts': 0,
        'last_error': null,
      },
      where: 'id = ?',
      whereArgs: [id],
    );
    notifyListeners();
    unawaited(_drain());
  }

  @override
  void dispose() {
    _drainTimer?.cancel();
    _db?.close();
    super.dispose();
  }
}
