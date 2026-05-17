import { Module } from '@nestjs/common';
import { CertificateTypeController } from './certificate-type.controller';
import { CertificateTypeService } from './certificate-type.service';

@Module({
  controllers: [CertificateTypeController],
  providers: [CertificateTypeService],
  exports: [CertificateTypeService],
})
export class CertificateTypeModule {}
