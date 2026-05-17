import { Injectable } from '@nestjs/common';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(auth: AuthContext, query: { unreadOnly?: boolean; vesselId?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.notification.findMany({
        where: {
          tenantId: auth.tenantId!,
          ...(query.unreadOnly === true && { readAt: null }),
          ...(query.vesselId !== undefined && { vesselId: query.vesselId }),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }

  markRead(auth: AuthContext, id: string) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.notification.update({
        where: { id },
        data: { readAt: new Date() },
      }),
    );
  }
}
