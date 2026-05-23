import { Module } from '@nestjs/common';
import { DrybmsElementController } from './drybms-element.controller';
import { DrybmsElementService } from './drybms-element.service';

@Module({ controllers: [DrybmsElementController], providers: [DrybmsElementService] })
export class DrybmsElementModule {}
