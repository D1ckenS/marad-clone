import { Module } from '@nestjs/common';
import { TechLibraryController } from './tech-library.controller';
import { TechLibraryService } from './tech-library.service';

@Module({
  controllers: [TechLibraryController],
  providers: [TechLibraryService],
})
export class TechLibraryModule {}
