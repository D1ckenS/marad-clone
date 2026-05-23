import { Module } from '@nestjs/common';
import { InspectionController } from './inspection.controller';
import { InspectionService } from './inspection.service';

@Module({ controllers: [InspectionController], providers: [InspectionService] })
export class InspectionModule {}
