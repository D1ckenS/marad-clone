import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { startSyncServer, type BlobMetaWire, type BlobUploadResult } from '@fleetops/sync-engine';
import { resolve } from 'node:path';
import { newId } from '@fleetops/domain';
import { AppModule } from '../src/app.module';
import { DrizzleService } from '../src/db/drizzle.service';
import { blobOutbox } from '../src/db/schema';
import { BlobUploaderService } from '../src/sync/blob-uploader.service';
import { StorageService } from '../src/storage/storage.service';

/**
 * P5 follow-up — blob (photo-byte) sync vessel → shore.
 *
 * Test 1 covers the enqueue path: StorageService.put*() should insert a
 * row into blob_outbox after a successful S3 PUT.
 *
 * Test 2 covers the drain path: BlobUploaderService should pull pending
 * blob_outbox rows, fetch bytes from local S3, stream them via gRPC to
 * the shore receiver, and mark the row sent. We run a real in-process
 * gRPC server using sync-engine's startSyncServer({ blob }) and capture
 * what arrives.
 */

const PROTO_PATH = resolve(__dirname, '../../../packages/proto/sync.proto');

let app: INestApplication;
let drizzle: DrizzleService;
let storageStubBytes = new Map<string, Buffer>();

beforeAll(async () => {
  // Stub the vessel's S3Client at the StorageService level so put*() runs
  // its real DB-enqueue logic but doesn't talk to a real S3. We re-use
  // the existing override-provider pattern from other e2e files.
  const realModule = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useFactory({
      factory: (d: DrizzleService) => {
        // Reconstruct a StorageService whose S3 client is a Map-backed
        // stub. The real DrizzleService is reused so blob_outbox writes
        // hit the same in-memory DB the rest of the test queries.
        const stubS3 = {
          send: vi.fn(async (cmd: { input: { Key: string; Body: Buffer } }) => {
            storageStubBytes.set(cmd.input.Key, Buffer.from(cmd.input.Body));
            return {};
          }),
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new StorageService(stubS3 as any, 'fleetops-photos', d);
      },
      inject: [DrizzleService],
    })
    .compile();
  app = realModule.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  drizzle = app.get(DrizzleService);
});

afterAll(async () => {
  storageStubBytes = new Map();
  await app.close();
});

describe('blob-sync — enqueue path', () => {
  it('StorageService.put writes bytes to S3 AND inserts a blob_outbox row', async () => {
    const svc = app.get(StorageService);
    const ctx = { tenantId: 'TENANT_A', vesselId: 'VESSEL_A' };
    const key = `${ctx.tenantId}/${ctx.vesselId}/test/${newId()}/file.bin`;
    const body = Buffer.from('hello-from-vessel-side-storage');

    const returnedKey = await svc.put(ctx, key, body, 'application/octet-stream');
    expect(returnedKey).toBe(key);
    expect(storageStubBytes.get(key)?.equals(body)).toBe(true);

    const row = drizzle.db.select().from(blobOutbox).where(eq(blobOutbox.key, key)).get();
    expect(row).toBeDefined();
    expect(row!.sizeBytes).toBe(body.length);
    expect(row!.sentAt).toBeNull();
    expect(row!.attemptCount).toBe(0);
    expect(row!.sha256).toHaveLength(64); // hex sha256
    expect(row!.tenantId).toBe(ctx.tenantId);
    expect(row!.vesselId).toBe(ctx.vesselId);
  });

  it('putJobHistoryPhoto enqueues with the correct key shape', async () => {
    const svc = app.get(StorageService);
    const ctx = { tenantId: 'TENANT_X', vesselId: 'VESSEL_X', jobHistoryId: 'JH_99' };
    const file = {
      buffer: Buffer.from('photo-bytes'),
      originalname: 'wild file name!.jpg',
      mimetype: 'image/jpeg',
    };

    const key = await svc.putJobHistoryPhoto(ctx, 0, file);
    expect(key).toMatch(/^TENANT_X\/VESSEL_X\/job-history\/JH_99\/photos\/0-wild_file_name_.jpg$/);

    const row = drizzle.db.select().from(blobOutbox).where(eq(blobOutbox.key, key)).get();
    expect(row).toBeDefined();
    expect(row!.contentType).toBe('image/jpeg');
    expect(row!.sizeBytes).toBe(file.buffer.length);
  });
});

describe('blob-sync — drain path', () => {
  it('uploader streams pending blob_outbox rows to shore and marks sent', async () => {
    // Reset state from the enqueue tests above.
    drizzle.db.delete(blobOutbox).run();
    storageStubBytes.clear();

    // 1. Seed a pending blob: put bytes in the stub S3 + insert outbox row
    const ctx = { tenantId: 'TENANT_DRAIN', vesselId: 'VESSEL_DRAIN' };
    const key = `${ctx.tenantId}/${ctx.vesselId}/drain-test/${newId()}/payload.bin`;
    const body = Buffer.alloc(300 * 1024); // 300 KiB → 2 chunks at 256 KiB
    body.fill(0xab);
    storageStubBytes.set(key, body);
    drizzle.db
      .insert(blobOutbox)
      .values({
        id: newId(),
        key,
        contentType: 'application/octet-stream',
        sizeBytes: body.length,
        sha256: '', // empty = receiver skips verification
        tenantId: ctx.tenantId,
        vesselId: ctx.vesselId,
      })
      .run();

    // 2. Boot a fake shore-side server that captures what the uploader sends.
    const received: Array<{ meta: BlobMetaWire; bodyLen: number }> = [];
    const server = await startSyncServer('127.0.0.1:0', {
      protoPath: PROTO_PATH,
      onStreamOpen: async () => ({
        welcome: { cursors: {}, sessionId: 'test' },
        onReceive: async () => undefined,
        onClose: async () => undefined,
      }),
      blob: async (meta, payload): Promise<BlobUploadResult> => {
        received.push({ meta, bodyLen: payload.length });
        return { storedBytes: payload.length, sha256Verified: false, sessionId: 'srv' };
      },
    });

    try {
      // 3. Construct the uploader pointing at the fake server.
      process.env['SHORE_SYNC_URL'] = `127.0.0.1:${server.port}`;
      process.env['SYNC_PROTO_PATH'] = PROTO_PATH;
      const uploader = new BlobUploaderService(drizzle);

      // Replace the uploader's internal S3 with our Map-backed stub.
      const stubS3 = {
        send: vi.fn(async (cmd: { input: { Key: string } }) => ({
          Body: bufferToWebStream(storageStubBytes.get(cmd.input.Key)!),
        })),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (uploader as any).s3 = stubS3;

      const result = await uploader.drain();
      expect(result).toEqual({ uploaded: 1, failed: 0 });

      // 4. Assert the receiver got the full payload.
      expect(received).toHaveLength(1);
      expect(received[0]!.meta.key).toBe(key);
      expect(received[0]!.bodyLen).toBe(body.length);

      // 5. Assert blob_outbox row is marked sent.
      const row = drizzle.db.select().from(blobOutbox).where(eq(blobOutbox.key, key)).get();
      expect(row!.sentAt).not.toBeNull();
      expect(row!.lastError).toBeNull();
    } finally {
      await server.shutdown();
    }
  });

  it('uploader marks attempts on failure and does not lose the row', async () => {
    drizzle.db.delete(blobOutbox).run();
    storageStubBytes.clear();

    const ctx = { tenantId: 'TENANT_FAIL', vesselId: 'VESSEL_FAIL' };
    const key = `${ctx.tenantId}/${ctx.vesselId}/fail-test/${newId()}/payload.bin`;
    const body = Buffer.from('this will fail to upload');
    storageStubBytes.set(key, body);
    drizzle.db
      .insert(blobOutbox)
      .values({
        id: newId(),
        key,
        contentType: 'application/octet-stream',
        sizeBytes: body.length,
        sha256: '',
        tenantId: ctx.tenantId,
        vesselId: ctx.vesselId,
      })
      .run();

    // Point at a port nothing is listening on
    process.env['SHORE_SYNC_URL'] = '127.0.0.1:9'; // discard port
    process.env['SYNC_PROTO_PATH'] = PROTO_PATH;
    const uploader = new BlobUploaderService(drizzle);
    const stubS3 = {
      send: vi.fn(async (cmd: { input: { Key: string } }) => ({
        Body: bufferToWebStream(storageStubBytes.get(cmd.input.Key)!),
      })),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (uploader as any).s3 = stubS3;

    const result = await uploader.drain();
    expect(result.uploaded).toBe(0);
    expect(result.failed).toBe(1);

    const row = drizzle.db.select().from(blobOutbox).where(eq(blobOutbox.key, key)).get();
    expect(row!.sentAt).toBeNull();
    expect(row!.attemptCount).toBeGreaterThanOrEqual(1);
    expect(row!.lastError).toBeTruthy();
  });
});

// Helper — produce a node ReadableStream from a Buffer for the S3 mock.
function bufferToWebStream(buf: Buffer): import('node:stream/web').ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(buf);
      controller.close();
    },
  });
}
