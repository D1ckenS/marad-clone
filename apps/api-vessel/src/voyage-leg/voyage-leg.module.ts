import { Module } from '@nestjs/common';
import { VoyageLegController } from './voyage-leg.controller';
import { VoyageLegService } from './voyage-leg.service';

@Module({ controllers: [VoyageLegController], providers: [VoyageLegService] })
export class VoyageLegModule {}
