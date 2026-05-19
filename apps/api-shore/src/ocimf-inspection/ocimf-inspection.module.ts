import { Module } from '@nestjs/common';
import { OcimfInspectionController } from './ocimf-inspection.controller';
import { OcimfInspectionService } from './ocimf-inspection.service';

@Module({
  controllers: [OcimfInspectionController],
  providers: [OcimfInspectionService],
})
export class OcimfInspectionModule {}
