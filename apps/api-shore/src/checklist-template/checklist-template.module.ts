import { Module } from '@nestjs/common';
import { ChecklistTemplateController } from './checklist-template.controller';
import { ChecklistTemplateService } from './checklist-template.service';

@Module({ controllers: [ChecklistTemplateController], providers: [ChecklistTemplateService] })
export class ChecklistTemplateModule {}
