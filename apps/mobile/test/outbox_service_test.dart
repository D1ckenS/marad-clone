import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:fleetops_mobile/services/api_client.dart';
import 'package:fleetops_mobile/services/outbox_service.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

/// In-memory ApiClient that can be primed to either succeed, throw a
/// network error, or throw a specific HTTP status.
class _ScriptedApiClient extends ApiClient {
  final List<Object> behaviours = []; // 'ok' | SocketException | ApiException
  final List<({String method, String path, Map<String, dynamic> body})> calls = [];

  @override
  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    calls.add((method: 'POST', path: path, body: body));
    return _consume();
  }

  @override
  Future<dynamic> patch(String path, Map<String, dynamic> body) async {
    calls.add((method: 'PATCH', path: path, body: body));
    return _consume();
  }

  Object? _consume() {
    if (behaviours.isEmpty) return {'ok': true};
    final next = behaviours.removeAt(0);
    if (next == 'ok') return {'ok': true};
    if (next is Exception) throw next;
    return next;
  }
}

/// Test-side path_provider stub so getApplicationSupportDirectory returns a
/// real temp dir instead of throwing MissingPluginException.
class _FakePathProvider extends PathProviderPlatform {
  final Directory tempDir;
  _FakePathProvider(this.tempDir);

  @override
  Future<String?> getApplicationSupportPath() async => tempDir.path;
  @override
  Future<String?> getTemporaryPath() async => tempDir.path;
  @override
  Future<String?> getApplicationDocumentsPath() async => tempDir.path;
}

void main() {
  // sqflite needs the FFI backend on the desktop test VM; the default
  // backend assumes Android/iOS.
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  late Directory tempDir;
  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('fleetops_outbox_test_');
    PathProviderPlatform.instance = _FakePathProvider(tempDir);
  });

  tearDown(() async {
    if (tempDir.existsSync()) {
      tempDir.deleteSync(recursive: true);
    }
  });

  group('OutboxService.postOrQueue', () {
    test('returns API response on immediate success (no queueing)', () async {
      final client = _ScriptedApiClient()..behaviours.addAll(['ok']);
      final outbox = OutboxService(client);
      await outbox.init();

      final result = await outbox.postOrQueue('/rest-hour-entries', {'a': 1});

      expect(result, {'ok': true});
      expect(await outbox.pendingCount(), 0);
      outbox.dispose();
    });

    test('queues POST on SocketException and returns null', () async {
      final client = _ScriptedApiClient()
        ..behaviours.add(const SocketException('Connection refused'));
      final outbox = OutboxService(client);
      await outbox.init();

      final result = await outbox.postOrQueue('/rest-hour-entries', {'a': 1});

      expect(result, isNull);
      expect(await outbox.pendingCount(), 1);
      final entries = await outbox.listOpen();
      expect(entries.first.path, '/rest-hour-entries');
      expect(entries.first.method, 'POST');
      expect(entries.first.body, {'a': 1});
      outbox.dispose();
    });

    test('queues POST on 5xx server error', () async {
      final client = _ScriptedApiClient()
        ..behaviours.add(const ApiException(503, 'temporarily unavailable'));
      final outbox = OutboxService(client);
      await outbox.init();

      await outbox.postOrQueue('/jhas', {'ref': 'JHA-1'});

      expect(await outbox.pendingCount(), 1);
      outbox.dispose();
    });

    test('does NOT queue 4xx errors — rethrows for the caller to surface', () async {
      final client = _ScriptedApiClient()
        ..behaviours.add(const ApiException(400, 'identifier should not be empty'));
      final outbox = OutboxService(client);
      await outbox.init();

      await expectLater(
        () => outbox.postOrQueue('/auth/login', {}),
        throwsA(isA<ApiException>()),
      );
      expect(await outbox.pendingCount(), 0);
      outbox.dispose();
    });

    test('drainNow re-attempts queued entries and marks them sent on success',
        () async {
      // First call fails (gets queued), drain succeeds.
      final client = _ScriptedApiClient()
        ..behaviours.add(const SocketException('refused'))
        ..behaviours.add('ok');
      final outbox = OutboxService(client);
      await outbox.init();

      await outbox.postOrQueue('/discharge-logs', {'kind': 'OIL'});
      expect(await outbox.pendingCount(), 1);

      await outbox.drainNow();
      expect(await outbox.pendingCount(), 0);
      expect(await outbox.failedCount(), 0);
      // Two calls total: initial enqueue attempt + the drain attempt.
      expect(client.calls.length, 2);
      expect(client.calls.last.path, '/discharge-logs');
      outbox.dispose();
    });

    test('drain marks 4xx entries as failed (not retried forever)', () async {
      final client = _ScriptedApiClient()
        ..behaviours.add(const SocketException('refused')) // first POST queues
        ..behaviours.add(const ApiException(422, 'validation failed')); // drain gets 4xx

      final outbox = OutboxService(client);
      await outbox.init();

      await outbox.postOrQueue('/jhas', {'ref': ''});
      await outbox.drainNow();

      expect(await outbox.pendingCount(), 0);
      expect(await outbox.failedCount(), 1);
      final entries = await outbox.listOpen();
      expect(entries.first.status, OutboxStatus.failed);
      expect(entries.first.lastError, contains('422'));
      outbox.dispose();
    });

    test('retry() moves a failed entry back to pending', () async {
      final client = _ScriptedApiClient()
        ..behaviours.add(const SocketException('refused'))
        ..behaviours.add(const ApiException(409, 'conflict'))
        ..behaviours.add('ok');

      final outbox = OutboxService(client);
      await outbox.init();

      await outbox.postOrQueue('/audits', {'kind': 'INTERNAL'});
      await outbox.drainNow();
      expect(await outbox.failedCount(), 1);

      final failedEntry = (await outbox.listOpen()).first;
      await outbox.retry(failedEntry.id);

      // retry() kicks off drain; give it a beat to finish.
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(await outbox.failedCount(), 0);
      expect(await outbox.pendingCount(), 0);
      outbox.dispose();
    });

    test('discard() removes a failed entry', () async {
      final client = _ScriptedApiClient()
        ..behaviours.add(const SocketException('refused'))
        ..behaviours.add(const ApiException(400, 'bad'));

      final outbox = OutboxService(client);
      await outbox.init();

      await outbox.postOrQueue('/jhas', {'ref': ''});
      await outbox.drainNow();
      final failed = (await outbox.listOpen()).first;

      await outbox.discard(failed.id);
      expect((await outbox.listOpen()).length, 0);
      outbox.dispose();
    });
  });
}
