import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CertificateService } from './certificate.service';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';

@Controller('certificates')
@UseGuards(JwtAuthGuard)
export class CertificateController {
  constructor(private readonly svc: CertificateService) {}

  @Post()
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateCertificateDto) {
    return this.svc.create(auth, dto);
  }

  @Get()
  findAll(
    @AuthCtx() auth: AuthContext,
    @Query('subjectType') subjectType?: string,
    @Query('subjectId') subjectId?: string,
    @Query('vesselId') vesselId?: string,
  ) {
    return this.svc.findAll(auth, {
      ...(subjectType !== undefined && { subjectType }),
      ...(subjectId !== undefined && { subjectId }),
      ...(vesselId !== undefined && { vesselId }),
    });
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }

  @Patch(':id')
  update(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateCertificateDto) {
    return this.svc.update(auth, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
}
