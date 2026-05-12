import { Injectable, Logger } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Vessel-side storage. In dev shares the docker-compose MinIO with shore;
 * in production a vessel install will have its OWN local MinIO (or
 * filesystem-backed equivalent) since vessels can't always reach a remote
 * S3 bucket. The actual photo-byte sync between vessel and shore is a
 * deferred concern (P5 sync hardening) — for now we replicate only the
 * S3 keys via the outbox, and the bytes are assumed reachable.
 */
@Injectable()
export class StorageService {
  private readonly log = new Logger(StorageService.name);

  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
  ) {}

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
