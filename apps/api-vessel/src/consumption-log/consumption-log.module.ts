import { Module } from '@nestjs/common';
import { ConsumptionLogController } from './consumption-log.controller';
import { ConsumptionLogService } from './consumption-log.service';

@Module({ controllers: [ConsumptionLogController], providers: [ConsumptionLogService] })
export class ConsumptionLogModule {}
