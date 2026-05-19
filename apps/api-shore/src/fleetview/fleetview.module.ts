import { Module } from '@nestjs/common';
import { FleetviewController } from './fleetview.controller';
import { FleetviewService } from './fleetview.service';

@Module({
  controllers: [FleetviewController],
  providers: [FleetviewService],
})
export class FleetviewModule {}
