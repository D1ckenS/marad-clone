import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { GetObjectCommand, S3Client, type GetObjectCommandOutput } from '@aws-sdk/client-s3';
import { and, asc, eq, isNull, lte, or, sql } from 'drizzle-orm';
import * as grpc from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { syncClientCredentials } from '@fleetops/sync-engine';
import { DrizzleService } from '../db/drizzle.service';
import { blobOutbox } from '../db/schema';

const PROTO_PATH_DEFAULT = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'proto',
  'sync.proto',
);

const CHUNK_BYTES = 256 * 1024; // 256 KiB per chunk
const DRAIN_BATCH = 8; // max blobs per drain tick
const MAX_ATTEMPTS = 8; // give up after this many failures
const BASE_BACKOFF_MS = 5_000; // first retry waits 5s, then 10s, 20s, ...

interface BlobChunkWire {
  meta?: {
    key: string;
    contentType: string;
    sizeBytes: string | number;
    sha256: string;
    tenantId: string;
    vesselId: string;
  };
  body: Buffer;
  index: number;
}

interface BlobUploadAckWire {
  key: string;
  storedBytes: string | number;
  sha256Verified: boolean;
  sessionId: string;
}

type BlobServiceClient = grpc.Client & {
  uploadBlob: (
    metadata: grpc.Metadata,
    cb: (err: grpc.ServiceError | null, ack?: BlobUploadAckWire) => void,
  ) => grpc.ClientWritableStream<BlobChunkWire>;
};

/**
 * Drains the blob_outbox queue, streaming pending payloads to shore via
 * the gRPC BlobService.UploadBlob RPC. Runs as a periodic background
 * worker when SYNC_ENABLED=1, in parallel with SyncClientService.
 *
 * Lifecycle per row:
 *   - SELECT pending where sent_at IS NULL AND attempts < MAX AND
 *     next-retry-time <= now (exponential backoff on attempt_count).
 *   - GetObject from local S3 by key.
 *   - Open UploadBlob stream, write a meta-only chunk, then body chunks.
 *   - On ack, set sent_at + clear last_error.
 *   - On failure, bump attempt_count + store last_error. Backoff is
 *     applied next tick.
 */
@Injectable()
export class BlobUploaderService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(BlobUploaderService.name);
  private timer: NodeJS.Timeout | null = null;
  private stopping = false;
  private draining = false;
  private client: BlobServiceClient | null = null;
  private readonly s3: S3Client;

  constructor(private readonly drizzle: DrizzleService) {
    const endpoint = process.env['S3_ENDPOINT'];
    const forcePathStyle = (process.env['S3_FORCE_PATH_STYLE'] ?? '1') === '1';
    this.s3 = new S3Client({
      region: process.env['S3_REGION'] ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env['S3_ACCESS_KEY_ID'] ?? '',
        secretAccessKey: process.env['S3_SECRET_ACCESS_KEY'] ?? '',
      },
      ...(endpoint !== undefined && endpoint.trim() !== '' && { endpoint, forcePathStyle }),
    });
  }

  onApplicationBootstrap(): void {
    if (process.env['SYNC_ENABLED'] !== '1') {
      this.log.log('SYNC_ENABLED!=1 — blob uploader idle');
      return;
    }
    const intervalMs = Number(process.env['BLOB_SYNC_INTERVAL_MS'] ?? 10_000);
    this.timer = setInterval(() => {
      if (!this.draining) void this.drain();
    }, intervalMs);
    this.log.log(`blob uploader running every ${intervalMs}ms`);
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.client !== null) {
      this.client.close();
      this.client = null;
    }
  }

  /** Public for testability — drains exactly one batch synchronously. */
  async drain(): Promise<{ uploaded: number; failed: number }> {
    if (this.stopping) return { uploaded: 0, failed: 0 };
    this.draining = true;
    let uploaded = 0;
    let failed = 0;
    try {
      const rows = this.pickBatch();
      for (const row of rows) {
        const ok = await this.uploadOne(row).catch((e: unknown) => {
          this.markFailure(row.id, e instanceof Error ? e.message : String(e));
          return false;
        });
        if (ok) uploaded++;
        else failed++;
      }
    } finally {
      this.draining = false;
    }
    return { uploaded, failed };
  }

  /**
   * Pick up to DRAIN_BATCH pending rows whose backoff window has expired.
   * Backoff = BASE_BACKOFF_MS * 2^(attempt_count - 1), capped at the
   * 8th attempt. We compute the "ready time" inline as a SQL expression:
   *   ready_at = created_at + BASE_BACKOFF_MS * (1 << min(attempt_count, 6))
   */
  private pickBatch(): Array<{
    id: string;
    key: string;
    contentType: string;
    sizeBytes: number;
    sha256: string | null;
    tenantId: string;
    vesselId: string;
    attemptCount: number;
  }> {
    const nowMs = Date.now();
    return this.drizzle.db
      .select({
        id: blobOutbox.id,
        key: blobOutbox.key,
        contentType: blobOutbox.contentType,
        sizeBytes: blobOutbox.sizeBytes,
        sha256: blobOutbox.sha256,
        tenantId: blobOutbox.tenantId,
        vesselId: blobOutbox.vesselId,
        attemptCount: blobOutbox.attemptCount,
      })
      .from(blobOutbox)
      .where(
        and(
          isNull(blobOutbox.sentAt),
          lte(blobOutbox.attemptCount, MAX_ATTEMPTS),
          // First attempt: any time. Subsequent: respect backoff.
          or(
            eq(blobOutbox.attemptCount, 0),
            sql`(${blobOutbox.createdAt} + ${BASE_BACKOFF_MS} * (1 << MIN(${blobOutbox.attemptCount}, 6))) <= ${nowMs}`,
          ),
        ),
      )
      .orderBy(asc(blobOutbox.createdAt))
      .limit(DRAIN_BATCH)
      .all();
  }

  private async uploadOne(row: {
    id: string;
    key: string;
    contentType: string;
    sizeBytes: number;
    sha256: string | null;
    tenantId: string;
    vesselId: string;
  }): Promise<boolean> {
    // 1. Fetch bytes from LOCAL S3.
    const bucket = process.env['S3_BUCKET'] ?? 'fleetops-photos';
    const got: GetObjectCommandOutput = await this.s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: row.key }),
    );
    if (got.Body === undefined) {
      throw new Error(`empty body for key=${row.key}`);
    }
    const stream =
      got.Body instanceof Readable
        ? got.Body
        : Readable.fromWeb(got.Body as unknown as import('node:stream/web').ReadableStream);
    const buffer = await streamToBuffer(stream);
    if (buffer.length !== row.sizeBytes) {
      this.log.warn(
        `byte-count mismatch for key=${row.key}: expected=${row.sizeBytes} got=${buffer.length} — uploading anyway`,
      );
    }

    // 2. Open RPC + stream chunks.
    const client = this.ensureClient();
    const ack = await new Promise<BlobUploadAckWire>((resolveAck, rejectAck) => {
      const md = new grpc.Metadata();
      const token = process.env['SYNC_AUTH_TOKEN'];
      if (token !== undefined) md.set('authorization', token);
      const call = client.uploadBlob(md, (err, ackMsg) => {
        if (err !== null) rejectAck(err);
        else if (ackMsg === undefined) rejectAck(new Error('upload ack missing'));
        else resolveAck(ackMsg);
      });
      // First chunk: meta + first slice (or empty body if zero-length blob)
      const totalChunks = Math.max(1, Math.ceil(buffer.length / CHUNK_BYTES));
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_BYTES;
        const end = Math.min(start + CHUNK_BYTES, buffer.length);
        const slice = buffer.subarray(start, end);
        const chunk: BlobChunkWire = {
          body: slice,
          index: i,
          ...(i === 0 && {
            meta: {
              key: row.key,
              contentType: row.contentType,
              sizeBytes: buffer.length,
              sha256: row.sha256 ?? '',
              tenantId: row.tenantId,
              vesselId: row.vesselId,
            },
          }),
        };
        call.write(chunk);
      }
      call.end();
    });

    // 3. Mark sent.
    this.drizzle.db
      .update(blobOutbox)
      .set({ sentAt: Date.now(), lastError: null })
      .where(eq(blobOutbox.id, row.id))
      .run();
    this.log.debug(`uploaded blob key=${row.key} bytes=${ack.storedBytes}`);
    return true;
  }

  private markFailure(id: string, message: string): void {
    this.drizzle.db
      .update(blobOutbox)
      .set({
        attemptCount: sql`${blobOutbox.attemptCount} + 1`,
        lastError: message.slice(0, 500),
      })
      .where(eq(blobOutbox.id, id))
      .run();
  }

  private ensureClient(): BlobServiceClient {
    if (this.client !== null) return this.client;
    const protoPath = process.env['SYNC_PROTO_PATH'] ?? PROTO_PATH_DEFAULT;
    const packageDef = loadSync(protoPath, {
      keepCase: false,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const proto = grpc.loadPackageDefinition(packageDef) as unknown as {
      fleetops: { sync: { v1: { BlobService: grpc.ServiceClientConstructor } } };
    };
    const Ctor = proto.fleetops.sync.v1.BlobService;
    const address = process.env['SHORE_SYNC_URL'] ?? 'localhost:50051';
    // B1: mTLS when SYNC_TLS_{CA,CERT,KEY}_PATH are set; refuse-to-boot in
    // production when missing. Same helper the sync client uses so vessel
    // presents the same client cert on both channels.
    this.client = new Ctor(address, syncClientCredentials()) as unknown as BlobServiceClient;
    return this.client;
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const parts: Buffer[] = [];
  for await (const chunk of stream) {
    parts.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(parts);
}
