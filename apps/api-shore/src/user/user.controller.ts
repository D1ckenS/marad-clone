import { Body, Controller, Param, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('tenants/:tenantId/users')
export class UserController {
  constructor(private readonly users: UserService) {}

  @Post()
  create(@Param('tenantId') tenantId: string, @Body() dto: CreateUserDto) {
    return this.users.create(tenantId, dto);
  }
}
