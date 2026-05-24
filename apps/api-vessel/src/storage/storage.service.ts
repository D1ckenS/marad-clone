import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { newId } from '@fleetops/domain';
import { DrizzleService } from '../db/drizzle.service';
import { blobOutbox } from '../db/schema';

/**
 * Vessel-side storage. Every successful put also enqueues a blob_outbox
 * row so a background worker (BlobUploaderService) can stream the bytes
 * to shore via gRPC BlobService. Until that drain happens the bytes
 * exist only in the vessel's local MinIO/filesystem.
 *
 * Vessel installs in production each run their OWN local MinIO; shore
 * has its own. The blob_outbox is the bridge.
 *
 * Storage layout:
 *   `${tenantId}/${vesselId}/<entity>/${entityId}/<slot>/<idx>-<safeName>`
 *
 * Callers don't need to do anything special — putJobHistoryPhoto and the
 * generic put() both enqueue automatically.
 */
@Injectable()
export class StorageService {
  private readonly log = new Logger(StorageService.name);

  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
    private readonly drizzle: DrizzleService,
  ) {}

  /**
   * Generic put. Caller chooses the key. Returns the same key for
   * symmetry with the typed helpers.
   */
  async put(
    ctx: { tenantId: string; vesselId: string },
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    this.enqueue(ctx, key, body, contentType);
    this.log.debug(`uploaded key=${key} size=${body.length} enqueued for shore sync`);
    return key;
  }

  async putJobHistoryPhoto(
    ctx: { tenantId: string; vesselId: string; jobHistoryId: string },
    idx: number,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<string> {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const key = `${ctx.tenantId}/${ctx.vesselId}/job-history/${ctx.jobHistoryId}/photos/${idx}-${safeName}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    this.enqueue(
      { tenantId: ctx.tenantId, vesselId: ctx.vesselId },
      key,
      file.buffer,
      file.mimetype,
    );
    this.log.debug(`uploaded photo key=${key} size=${file.buffer.length} enqueued for shore sync`);
    return key;
  }

  /**
   * Insert a pending blob_outbox row. Best-effort: a failure here logs
   * but does NOT rethrow — the S3 PUT already succeeded and the caller
   * cares more about the entity write completing than about sync
   * progress. (A future migration could promote this to a "missed
   * blobs" reconciliation pass that scans S3 against outbox rows.)
   */
  private enqueue(
    ctx: { tenantId: string; vesselId: string },
    key: string,
    body: Buffer,
    contentType: string,
  ): void {
    try {
      const sha256 = createHash('sha256').update(body).digest('hex');
      this.drizzle.db
        .insert(blobOutbox)
        .values({
          id: newId(),
          key,
          contentType,
          sizeBytes: body.length,
          sha256,
          tenantId: ctx.tenantId,
          vesselId: ctx.vesselId,
        })
        .run();
    } catch (e) {
      this.log.warn(
        `blob_outbox enqueue failed for key=${key} — bytes stored locally but will not sync until reconciliation: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }
}
