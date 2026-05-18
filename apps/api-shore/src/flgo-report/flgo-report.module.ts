import { Module } from '@nestjs/common';
import { FlgoReportController } from './flgo-report.controller';
import { FlgoReportService } from './flgo-report.service';

@Module({ controllers: [FlgoReportController], providers: [FlgoReportService] })
export class FlgoReportModule {}
