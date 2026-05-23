import { Module } from '@nestjs/common';
import { DischargeLogController } from './discharge-log.controller';
import { DischargeLogService } from './discharge-log.service';

@Module({ controllers: [DischargeLogController], providers: [DischargeLogService] })
export class DischargeLogModule {}
