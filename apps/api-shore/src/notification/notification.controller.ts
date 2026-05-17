import { Controller, Get, HttpCode, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuthCtx } from '../auth/auth-ctx.decorator';
import type { AuthContext } from '../auth/auth-context';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly svc: NotificationService) {}

  @Get()
  findAll(
    @AuthCtx() auth: AuthContext,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('vesselId') vesselId?: string,
  ) {
    return this.svc.findAll(auth, {
      unreadOnly: unreadOnly === 'true',
      ...(vesselId !== undefined && { vesselId }),
    });
  }

  @Patch(':id/read')
  @HttpCode(200)
  markRead(@AuthCtx() auth: AuthContext, @Param('id') id: string) {
    return this.svc.markRead(auth, id);
  }
}
