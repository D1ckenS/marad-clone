import { createHash, randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { BlobMetaWire, BlobUploadResult } from '@fleetops/sync-engine';

/**
 * Shore-side blob receiver. Plugged into `startSyncServer({ blob })` from
 * SyncGatewayService. Persists incoming blobs to shore-side S3 (or
 * S3-compatible storage like MinIO) under the same key vessels wrote
 * them as. Idempotent: a retried upload simply overwrites.
 *
 * Sha256 verification: when the vessel sends a non-empty `sha256` in
 * meta, we hash the assembled body and refuse to commit on mismatch.
 *
 * Bucket comes from the same `S3_BUCKET` env var the shore StorageService
 * uses, so a `GET <bucket>/<key>` from the shore app picks up the byte
 * payload immediately after a successful upload.
 */
@Injectable()
export class BlobReceiverService {
  private readonly log = new Logger(BlobReceiverService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor() {
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
    this.bucket = process.env['S3_BUCKET'] ?? 'fleetops-photos';
  }

  /** Implements the sync-engine BlobServerHandler contract. */
  handle = async (meta: BlobMetaWire, body: Buffer): Promise<BlobUploadResult> => {
    if (body.length !== meta.sizeBytes) {
      this.log.warn(
        `byte-count mismatch key=${meta.key}: meta=${meta.sizeBytes} actual=${body.length}`,
      );
    }
    let sha256Verified = false;
    if (meta.sha256 !== '') {
      const got = createHash('sha256').update(body).digest('hex');
      if (got !== meta.sha256) {
        throw new Error(`sha256 mismatch for key=${meta.key}: expected=${meta.sha256} got=${got}`);
      }
      sha256Verified = true;
    }
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: meta.key,
        Body: body,
        ContentType: meta.contentType,
      }),
    );
    const sessionId = randomUUID();
    this.log.debug(
      `received blob key=${meta.key} bytes=${body.length} sha=${sha256Verified ? 'verified' : 'skipped'} session=${sessionId}`,
    );
    return { storedBytes: body.length, sha256Verified, sessionId };
  };
}
