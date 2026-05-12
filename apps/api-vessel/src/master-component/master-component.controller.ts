import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MasterComponentService } from './master-component.service';

@Controller('master-components')
@UseGuards(JwtAuthGuard)
export class MasterComponentController {
  constructor(private readonly masters: MasterComponentService) {}

  @Get()
  findAll(@AuthCtx() auth: AuthContext) {
    return this.masters.findAll(auth);
  }

  @Get(':id')
  findOne(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.masters.findOne(auth, id);
  }
}
