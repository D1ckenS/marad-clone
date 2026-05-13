import { Module } from '@nestjs/common';
import { StockLevelController } from './stock-level.controller';
import { StockLevelService } from './stock-level.service';

@Module({
  controllers: [StockLevelController],
  providers: [StockLevelService],
  exports: [StockLevelService],
})
export class StockLevelModule {}
