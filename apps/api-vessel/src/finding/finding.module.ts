import { Module } from '@nestjs/common';
import { FindingController } from './finding.controller';
import { FindingService } from './finding.service';

@Module({ controllers: [FindingController], providers: [FindingService] })
export class FindingModule {}
