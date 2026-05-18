import { Module } from '@nestjs/common';
import { TankController } from './tank.controller';
import { TankService } from './tank.service';

@Module({ controllers: [TankController], providers: [TankService] })
export class TankModule {}
