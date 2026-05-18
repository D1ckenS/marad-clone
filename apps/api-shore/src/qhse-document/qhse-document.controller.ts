import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QhseDocumentService } from './qhse-document.service';
import {
  CreateDocumentRevisionDto,
  CreateQhseDocumentDto,
  UpdateQhseDocumentDto,
} from './dto/create-qhse-document.dto';

@Controller('qhse-documents')
@UseGuards(JwtAuthGuard)
export class QhseDocumentController {
  constructor(private readonly svc: QhseDocumentService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateQhseDocumentDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(@AuthCtx() auth: AuthContext) {
    return this.svc.findAll(auth);
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Patch(':id')
  update(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateQhseDocumentDto,
  ) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }

  @Post(':id/revisions')
  addRevision(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: CreateDocumentRevisionDto,
  ) {
    return this.svc.addRevision(auth, id, dto);
  }

  @Get(':id/revisions')
  getRevisions(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.getRevisions(auth, id);
  }

  @Post('revisions/:revisionId/approve')
  approveRevision(
    @AuthCtx() auth: AuthContext,
    @Param('revisionId') revisionId: string,
    @Body('approvedByUserId') approvedByUserId: string,
  ) {
    return this.svc.approveRevision(auth, revisionId, approvedByUserId);
  }
}
