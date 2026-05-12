import { Module } from '@nestjs/common';
import { JobInstanceController } from './job-instance.controller';
import { JobInstanceService } from './job-instance.service';

@Module({
  controllers: [JobInstanceController],
  providers: [JobInstanceService],
  exports: [JobInstanceService],
})
export class JobInstanceModule {}
