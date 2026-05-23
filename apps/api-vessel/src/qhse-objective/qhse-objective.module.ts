import { Module } from '@nestjs/common';
import { QhseObjectiveController } from './qhse-objective.controller';
import { QhseObjectiveService } from './qhse-objective.service';

@Module({ controllers: [QhseObjectiveController], providers: [QhseObjectiveService] })
export class QhseObjectiveModule {}
