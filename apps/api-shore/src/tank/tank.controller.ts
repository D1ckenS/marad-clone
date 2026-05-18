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
import { TankService } from './tank.service';
import { CreateTankDto, UpdateTankDto } from './dto/create-tank.dto';

@Controller('tanks')
@UseGuards(JwtAuthGuard)
export class TankController {
  constructor(private readonly svc: TankService) {}

  @Post() create(@AuthCtx() auth: AuthContext, @Body() dto: CreateTankDto) {
    return this.svc.create(auth, dto);
  }
  @Get() findAll(
    @AuthCtx() auth: AuthContext,
    @Query('vesselId') vesselId?: string,
    @Query('tankType') tankType?: string,
  ) {
    return this.svc.findAll(auth, {
      ...(vesselId !== undefined && { vesselId }),
      ...(tankType !== undefined && { tankType }),
    });
  }
  @Get(':id') findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.findOne(auth, id);
  }
  @Patch(':id') update(
    @AuthCtx() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateTankDto,
  ) {
    return this.svc.update(auth, id, dto);
  }
  @Delete(':id') @HttpCode(204) remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.softDelete(auth, id);
  }
}
