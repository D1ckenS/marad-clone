import { Module } from '@nestjs/common';
import { WorkPermitController } from './work-permit.controller';
import { WorkPermitService } from './work-permit.service';

@Module({ controllers: [WorkPermitController], providers: [WorkPermitService] })
export class WorkPermitModule {}
