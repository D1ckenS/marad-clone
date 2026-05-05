import { Module } from '@nestjs/common';
import { VesselService } from './vessel.service';
import { VesselController } from './vessel.controller';

@Module({
  providers: [VesselService],
  controllers: [VesselController],
  exports: [VesselService],
})
export class VesselModule {}
