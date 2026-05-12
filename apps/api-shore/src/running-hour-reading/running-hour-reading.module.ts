import { Module } from '@nestjs/common';
import { RunningHourReadingController } from './running-hour-reading.controller';
import { RunningHourReadingService } from './running-hour-reading.service';

@Module({
  controllers: [RunningHourReadingController],
  providers: [RunningHourReadingService],
  exports: [RunningHourReadingService],
})
export class RunningHourReadingModule {}
