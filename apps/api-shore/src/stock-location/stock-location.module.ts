import { Module } from '@nestjs/common';
import { StockLocationController } from './stock-location.controller';
import { StockLocationService } from './stock-location.service';

@Module({
  controllers: [StockLocationController],
  providers: [StockLocationService],
  exports: [StockLocationService],
})
export class StockLocationModule {}
