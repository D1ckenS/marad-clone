import { Global, Module } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      useFactory: () => {
        const accessKeyId = process.env['S3_ACCESS_KEY_ID'] ?? '';
        const secretAccessKey = process.env['S3_SECRET_ACCESS_KEY'] ?? '';
        const region = process.env['S3_REGION'] ?? 'us-east-1';
        const bucket = process.env['S3_BUCKET'] ?? 'fleetops-photos';
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
