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
import { requireRole } from '../auth/role.guard';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserService } from './user.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly users: UserService,
    private readonly auth: AuthService,
  ) {}

  @Get('me')
  getMe(@AuthCtx() authCtx: AuthContext) {
    return this.users.getMe(authCtx.userId, authCtx.tenantId);
  }

  @Patch('me')
  async updateMe(@AuthCtx() authCtx: AuthContext, @Body() dto: UpdateProfileDto) {
    const updated = await this.users.updateMe(authCtx.userId, authCtx.tenantId, dto);
    const tokens = this.auth.issueTokens(updated);
    return { ...tokens, user: updated };
  }

  @Post()
  @UseGuards(requireRole('SUPER_ADMIN', 'TENANT_ADMIN'))
  create(@AuthCtx() auth: AuthContext, @Body() dto: CreateUserDto) {
    return this.users.create(auth.tenantId!, dto);
  }

  @Get()
  @UseGuards(requireRole('SUPER_ADMIN', 'TENANT_ADMIN'))
  findAll(@AuthCtx() auth: AuthContext) {
    return this.users.findAll(auth.tenantId!);
  }

  @Patch(':id')
  @UseGuards(requireRole('SUPER_ADMIN', 'TENANT_ADMIN'))
  update(@AuthCtx() auth: AuthContext, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(auth.tenantId!, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(requireRole('SUPER_ADMIN', 'TENANT_ADMIN'))
  remove(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.users.softDelete(auth.tenantId!, id);
  }
}
