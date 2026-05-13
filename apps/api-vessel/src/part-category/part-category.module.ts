import { Module } from '@nestjs/common';
import { PartCategoryController } from './part-category.controller';
import { PartCategoryService } from './part-category.service';

@Module({
  controllers: [PartCategoryController],
  providers: [PartCategoryService],
  exports: [PartCategoryService],
})
export class PartCategoryModule {}
