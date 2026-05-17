import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { CertificateController } from './certificate.controller';
import { CertificateService } from './certificate.service';

@Module({
  imports: [StorageModule],
  controllers: [CertificateController],
  providers: [CertificateService],
  exports: [CertificateService],
})
export class CertificateModule {}
