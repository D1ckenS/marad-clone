import { Module } from '@nestjs/common';
import { TankReadingController } from './tank-reading.controller';
import { TankReadingService } from './tank-reading.service';

@Module({ controllers: [TankReadingController], providers: [TankReadingService] })
export class TankReadingModule {}
