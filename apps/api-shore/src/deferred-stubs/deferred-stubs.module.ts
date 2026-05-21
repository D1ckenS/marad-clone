import { Module } from '@nestjs/common';
import { DeferredStubsController } from './deferred-stubs.controller';

@Module({ controllers: [DeferredStubsController] })
export class DeferredStubsModule {}
