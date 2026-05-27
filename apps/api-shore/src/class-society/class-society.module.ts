import { Module } from '@nestjs/common';
import { ClassSocietyController } from './class-society.controller';
import { ClassSocietyPollerService } from './class-society-poller.service';
import { ClassSocietyService } from './class-society.service';

// Note: ScheduleModule.forRoot() is registered at the AppModule level
// (root). The Cron decorator on ClassSocietyPollerService picks it up
// automatically once the scheduler is alive.
@Module({
  controllers: [ClassSocietyController],
  providers: [ClassSocietyService, ClassSocietyPollerService],
})
export class ClassSocietyModule {}
