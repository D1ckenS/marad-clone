import { Module } from '@nestjs/common';
import { SafetyEquipmentController } from './safety-equipment.controller';
import { SafetyEquipmentService } from './safety-equipment.service';

@Module({ controllers: [SafetyEquipmentController], providers: [SafetyEquipmentService] })
export class SafetyEquipmentModule {}
