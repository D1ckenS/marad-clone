import { Module } from '@nestjs/common';
import { JhaController } from './jha.controller';
import { JhaService } from './jha.service';

@Module({ controllers: [JhaController], providers: [JhaService] })
export class JhaModule {}
