import { Module } from '@nestjs/common';
import { DrillTypeController } from './drill-type.controller';
import { DrillTypeService } from './drill-type.service';

@Module({ controllers: [DrillTypeController], providers: [DrillTypeService] })
export class DrillTypeModule {}
