import { Module } from '@nestjs/common';
import { PermitTemplateController } from './permit-template.controller';
import { PermitTemplateService } from './permit-template.service';

@Module({ controllers: [PermitTemplateController], providers: [PermitTemplateService] })
export class PermitTemplateModule {}
