import { Module } from '@nestjs/common';
import { MasterComponentController } from './master-component.controller';
import { MasterComponentService } from './master-component.service';

@Module({
  controllers: [MasterComponentController],
  providers: [MasterComponentService],
  exports: [MasterComponentService],
})
export class MasterComponentModule {}
