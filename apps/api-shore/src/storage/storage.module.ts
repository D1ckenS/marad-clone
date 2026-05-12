import { Global, Module } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';

/**
 * Builds the S3 client + StorageService from env. In dev, point the
 * endpoint at the docker-compose MinIO; in production, leave the endpoint
 * unset and provide AWS credentials via the standard SDK chain.
 *
 *   S3_ENDPOINT          (optional, e.g. http://localhost:9000 for MinIO dev)
 *   S3_REGION            (default us-east-1)
 *   S3_ACCESS_KEY_ID     (required)
 *   S3_SECRET_ACCESS_KEY (required)
 *   S3_BUCKET            (default marad-photos)
 *   S3_FORCE_PATH_STYLE  (default '1' for MinIO compatibility)
 */
@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      useFactory: () => {
        const accessKeyId = process.env['S3_ACCESS_KEY_ID'] ?? '';
        const secretAccessKey = process.env['S3_SECRET_ACCESS_KEY'] ?? '';
        const region = process.env['S3_REGION'] ?? 'us-east-1';
        const bucket = process.env['S3_BUCKET'] ?? 'marad-photos';
        const endpoint = process.env['S3_ENDPOINT'];
        const forcePathStyle = (process.env['S3_FORCE_PATH_STYLE'] ?? '1') === '1';

        const client = new S3Client({
          region,
          credentials: { accessKeyId, secretAccessKey },
          ...(endpoint !== undefined && endpoint.trim() !== '' && { endpoint, forcePathStyle }),
        });
        return new StorageService(client, bucket);
      },
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
