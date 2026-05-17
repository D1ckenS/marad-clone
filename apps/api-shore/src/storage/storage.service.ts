import { Injectable, Logger } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Thin wrapper around the S3-compatible client used to store binary blobs
 * (currently only sign-off photos). The client is configured at module
 * registration with `S3_*` env vars; tests override the provider to avoid
 * needing a live MinIO/S3.
 *
 * Storage layout:
 *   `${tenantId}/${vesselId}/job-history/${jobHistoryId}/photos/${idx}-${safeName}`
 *
 * The full key is what gets stored in `JobHistory.photos[]` and replicated
 * via the outbox; actual byte transfer between vessel and shore is a
 * separate concern (deferred to P5 sync hardening — for dev both sides
 * share one MinIO).
 */
@Injectable()
export class StorageService {
  private readonly log = new Logger(StorageService.name);

  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
  ) {}

  /**
   * Upload a photo for a JobHistory sign-off and return the S3 key. Caller
   * is responsible for collecting all keys and persisting them in the
   * `JobHistory.photos` JSON array.
   */
  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    this.log.debug(`uploaded key=${key} size=${body.length}`);
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
    this.log.debug(`uploaded photo key=${key} size=${file.buffer.length}`);
    return key;
  }
}
