import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import { TenantBroadcastRecorder } from '../sync/tenant-broadcast-recorder';
import type {
  CreateManagementReviewDto,
  UpdateManagementReviewDto,
} from './dto/management-review.dto';

function broadcastFields(row: {
  tenantId: string;
  kind: string;
  scheduledAt: Date;
  chair: string;
  attendees: number;
  status: string;
  actionsTotal: number;
  actionsDone: number;
  summary: string | null;
}): Record<string, unknown> {
  return {
    tenantId: row.tenantId,
    kind: row.kind,
    scheduledAt: row.scheduledAt.toISOString(),
    chair: row.chair,
    attendees: row.attendees,
    status: row.status,
    actionsTotal: row.actionsTotal,
    actionsDone: row.actionsDone,
    summary: row.summary,
  };
}

@Injectable()
export class ManagementReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcaster: TenantBroadcastRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateManagementReviewDto) {
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const row = await tx.managementReview.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          kind: dto.kind,
          scheduledAt: new Date(dto.scheduledAt),
          chair: dto.chair,
          attendees: dto.attendees ?? 0,
          status: dto.status ?? 'SCHEDULED',
          actionsTotal: dto.actionsTotal ?? 0,
          actionsDone: dto.actionsDone ?? 0,
          summary: dto.summary ?? null,
        },
      });
      await this.broadcaster.broadcastUpsert(
        tx,
        auth.tenantId!,
        'ManagementReview',
        row.id,
        broadcastFields(row),
      );
      return row;
    });
  }

  findAll(auth: AuthContext, query: { status?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.managementReview.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.status && { status: query.status as never }),
        },
        orderBy: { scheduledAt: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.managementReview.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
      }),
    );
    if (!row) throw new NotFoundException(`ManagementReview ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateManagementReviewDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const row = await tx.managementReview.update({
        where: { id },
        data: {
          ...(dto.kind !== undefined && { kind: dto.kind }),
          ...(dto.scheduledAt !== undefined && { scheduledAt: new Date(dto.scheduledAt) }),
          ...(dto.chair !== undefined && { chair: dto.chair }),
          ...(dto.attendees !== undefined && { attendees: dto.attendees }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.actionsTotal !== undefined && { actionsTotal: dto.actionsTotal }),
          ...(dto.actionsDone !== undefined && { actionsDone: dto.actionsDone }),
          ...(dto.summary !== undefined && { summary: dto.summary }),
        },
      });
      await this.broadcaster.broadcastUpsert(
        tx,
        auth.tenantId!,
        'ManagementReview',
        row.id,
        broadcastFields(row),
      );
      return row;
    });
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, async (tx) => {
      await tx.managementReview.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.broadcaster.broadcastDelete(tx, auth.tenantId!, 'ManagementReview', id);
    });
  }
}
