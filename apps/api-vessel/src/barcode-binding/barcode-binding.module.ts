import { Module } from '@nestjs/common';
import { BarcodeBindingController } from './barcode-binding.controller';
import { BarcodeBindingService } from './barcode-binding.service';

@Module({
  controllers: [BarcodeBindingController],
  providers: [BarcodeBindingService],
  exports: [BarcodeBindingService],
})
export class BarcodeBindingModule {}
