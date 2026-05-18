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
import { RestHourEntryService } from './rest-hour-entry.service';
import { CreateRestHourEntryDto, UpdateRestHourEntryDto } from './dto/create-rest-hour-entry.dto';

@Controller('rest-hour-entries')
@UseGuards(JwtAuthGuard)
export class RestHourEntryController {
  constructor(private readonly svc: RestHourEntryService) {}

  @Post() create(@AuthCtx() auth: AuthContext, @Body() dto: CreateRestHourEntryDto) {
    return this.svc.create(auth, dto);
  }
  @Get() findAll(
    @AuthCtx() auth: AuthContext,
    @Query('vesselId') vesselId?: string,
    @Query('crewMemberId') crewMemberId?: string,
  ) {
    return this.svc.findAll(auth, {
      ...(vesselId !== undefined && { vesselId }),
      ...(crewMemberId !== undefined && { crewMemberId }),
    });
  }
  @Get(':id') findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }
  @Patch(':id') update(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateRestHourEntryDto,
  ) {
    return this.svc.update(auth, id, dto);
  }
  @Delete(':id') @HttpCode(204) remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
}
