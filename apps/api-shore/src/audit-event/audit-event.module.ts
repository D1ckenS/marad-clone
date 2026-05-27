import { Global, Module } from '@nestjs/common';
import { AuditEventController } from './audit-event.controller';
import { AuditEventService } from './audit-event.service';

// @Global so the AuditInterceptor (registered via APP_INTERCEPTOR in
// app.module.ts) can inject AuditEventService without each feature
// module importing AuditEventModule. The service is a thin Prisma
// wrapper and has no per-module state, so there's no leak risk.
@Global()
@Module({
  controllers: [AuditEventController],
  providers: [AuditEventService],
  exports: [AuditEventService],
})
export class AuditEventModule {}
