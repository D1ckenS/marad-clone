import { Module } from '@nestjs/common';
import { ChecklistInstanceController } from './checklist-instance.controller';
import { ChecklistInstanceService } from './checklist-instance.service';

@Module({ controllers: [ChecklistInstanceController], providers: [ChecklistInstanceService] })
export class ChecklistInstanceModule {}
