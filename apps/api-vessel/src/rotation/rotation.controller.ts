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
import { RotationService } from './rotation.service';
import { CreateRotationDto, UpdateRotationDto } from './dto/create-rotation.dto';

@Controller('rotations')
@UseGuards(JwtAuthGuard)
export class RotationController {
  constructor(private readonly svc: RotationService) {}

  @Post() create(@AuthCtx() auth: AuthContext, @Body() dto: CreateRotationDto) {
    return this.svc.create(auth, dto);
  }
  @Get() findAll(
    @AuthCtx() auth: AuthContext,
    @Query('vesselId') vesselId?: string,
    @Query('crewMemberId') crewMemberId?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.findAll(auth, {
      ...(vesselId !== undefined && { vesselId }),
      ...(crewMemberId !== undefined && { crewMemberId }),
      ...(status !== undefined && { status }),
    });
  }
  @Get(':id') findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }
  @Patch(':id') update(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateRotationDto,
  ) {
    return this.svc.update(auth, id, dto);
  }
  @Delete(':id') @HttpCode(204) remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
}
