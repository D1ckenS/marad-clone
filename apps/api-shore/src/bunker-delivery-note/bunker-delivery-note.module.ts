import { Module } from '@nestjs/common';
import { BunkerDeliveryNoteController } from './bunker-delivery-note.controller';
import { BunkerDeliveryNoteService } from './bunker-delivery-note.service';

@Module({ controllers: [BunkerDeliveryNoteController], providers: [BunkerDeliveryNoteService] })
export class BunkerDeliveryNoteModule {}
