import { Module } from '@nestjs/common';
import { AuditEventModule } from '../audit-event/audit-event.module';
import { JobHistoryController } from './job-history.controller';
import { JobHistoryService } from './job-history.service';

@Module({
  imports: [AuditEventModule],
  controllers: [JobHistoryController],
  providers: [JobHistoryService],
  exports: [JobHistoryService],
})
export class JobHistoryModule {}
