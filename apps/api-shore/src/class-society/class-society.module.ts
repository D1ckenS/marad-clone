import { Module } from '@nestjs/common';
import { ClassSocietyController } from './class-society.controller';
import { ClassSocietyService } from './class-society.service';

@Module({
  controllers: [ClassSocietyController],
  providers: [ClassSocietyService],
})
export class ClassSocietyModule {}
