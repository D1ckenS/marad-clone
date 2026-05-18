import { Module } from '@nestjs/common';
import { CrewCertificateController } from './crew-certificate.controller';
import { CrewCertificateService } from './crew-certificate.service';

@Module({ controllers: [CrewCertificateController], providers: [CrewCertificateService] })
export class CrewCertificateModule {}
