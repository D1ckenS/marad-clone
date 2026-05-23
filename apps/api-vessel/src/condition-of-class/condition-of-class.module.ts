import { Module } from '@nestjs/common';
import { ConditionOfClassController } from './condition-of-class.controller';
import { ConditionOfClassService } from './condition-of-class.service';

@Module({ controllers: [ConditionOfClassController], providers: [ConditionOfClassService] })
export class ConditionOfClassModule {}
