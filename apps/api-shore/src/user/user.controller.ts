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
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly users: UserService) {}

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
