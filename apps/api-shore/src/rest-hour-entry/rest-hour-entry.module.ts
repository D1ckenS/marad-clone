import { Module } from '@nestjs/common';
import { RestHourEntryController } from './rest-hour-entry.controller';
import { RestHourEntryService } from './rest-hour-entry.service';

@Module({ controllers: [RestHourEntryController], providers: [RestHourEntryService] })
export class RestHourEntryModule {}
