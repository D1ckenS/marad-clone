import { Module } from '@nestjs/common';
import { JobHistoryController } from './job-history.controller';
import { JobHistoryService } from './job-history.service';

@Module({
  controllers: [JobHistoryController],
  providers: [JobHistoryService],
  exports: [JobHistoryService],
})
export class JobHistoryModule {}
