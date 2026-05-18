import { Module } from '@nestjs/common';
import { QhseDocumentController } from './qhse-document.controller';
import { QhseDocumentService } from './qhse-document.service';

@Module({ controllers: [QhseDocumentController], providers: [QhseDocumentService] })
export class QhseDocumentModule {}
