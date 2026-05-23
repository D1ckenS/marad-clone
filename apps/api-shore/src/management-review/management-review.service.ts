import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateManagementReviewDto,
  UpdateManagementReviewDto,
} from './dto/management-review.dto';

@Injectable()
export class ManagementReviewService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateManagementReviewDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.managementReview.create({
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
      }),
    );
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
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.managementReview.update({
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
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.managementReview.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
