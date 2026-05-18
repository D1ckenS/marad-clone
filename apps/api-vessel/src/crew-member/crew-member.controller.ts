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
import { CrewMemberService } from './crew-member.service';
import { CreateCrewMemberDto, UpdateCrewMemberDto } from './dto/create-crew-member.dto';

@Controller('crew-members')
@UseGuards(JwtAuthGuard)
export class CrewMemberController {
  constructor(private readonly svc: CrewMemberService) {}

  @Post() create(@AuthCtx() auth: AuthContext, @Body() dto: CreateCrewMemberDto) {
    return this.svc.create(auth, dto);
  }
  @Get() findAll(
    @AuthCtx() auth: AuthContext,
    @Query('vesselId') vesselId?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.findAll(auth, {
      ...(vesselId !== undefined && { vesselId }),
      ...(status !== undefined && { status }),
    });
  }
  @Get(':id') findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }
  @Patch(':id') update(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateCrewMemberDto,
  ) {
    return this.svc.update(auth, id, dto);
  }
  @Delete(':id') @HttpCode(204) remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
}
