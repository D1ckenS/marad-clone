import { Module } from '@nestjs/common';
import { FuelProductController } from './fuel-product.controller';
import { FuelProductService } from './fuel-product.service';

@Module({ controllers: [FuelProductController], providers: [FuelProductService] })
export class FuelProductModule {}
