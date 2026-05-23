import { Module } from '@nestjs/common';
import { AuditFindingController } from './audit-finding.controller';
import { AuditFindingService } from './audit-finding.service';

@Module({ controllers: [AuditFindingController], providers: [AuditFindingService] })
export class AuditFindingModule {}
