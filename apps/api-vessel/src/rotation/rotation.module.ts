import { Module } from '@nestjs/common';
import { RotationController } from './rotation.controller';
import { RotationService } from './rotation.service';

@Module({ controllers: [RotationController], providers: [RotationService] })
export class RotationModule {}
