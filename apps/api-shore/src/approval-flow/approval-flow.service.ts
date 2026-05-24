import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { Prisma, Role } from '@prisma/client';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import { TenantBroadcastRecorder } from '../sync/tenant-broadcast-recorder';
import type { CreateApprovalFlowDto } from './dto/create-approval-flow.dto';
import type { CreateApprovalStepDto } from './dto/create-approval-step.dto';
import type { UpdateApprovalFlowDto } from './dto/update-approval-flow.dto';

function flowFields(row: {
  tenantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
}): Record<string, unknown> {
  return {
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
  };
}

function stepFields(row: {
  tenantId: string;
  flowId: string;
  stepOrder: number;
  approverRole: string;
  limitAmount: Prisma.Decimal | null;
  limitCurrency: string;
}): Record<string, unknown> {
  return {
    tenantId: row.tenantId,
    flowId: row.flowId,
    stepOrder: row.stepOrder,
    approverRole: row.approverRole,
    limitAmount: row.limitAmount?.toString() ?? null,
    limitCurrency: row.limitCurrency,
  };
}

@Injectable()
export class ApprovalFlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcaster: TenantBroadcastRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateApprovalFlowDto) {
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const row = await tx.approvalFlow.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          name: dto.name,
          description: dto.description ?? null,
          isActive: dto.isActive ?? true,
        },
      });
      await this.broadcaster.broadcastUpsert(
        tx,
        auth.tenantId!,
        'ApprovalFlow',
        row.id,
        flowFields(row),
      );
      return row;
    });
  }

  findAll(auth: AuthContext) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.approvalFlow.findMany({
        where: { tenantId: auth.tenantId!, deletedAt: null },
        include: { steps: { where: { deletedAt: null }, orderBy: { stepOrder: 'asc' } } },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.approvalFlow.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
        include: { steps: { where: { deletedAt: null }, orderBy: { stepOrder: 'asc' } } },
      }),
    );
    if (row === null) throw new NotFoundException(`ApprovalFlow ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateApprovalFlowDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const row = await tx.approvalFlow.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
      await this.broadcaster.broadcastUpsert(
        tx,
        auth.tenantId!,
        'ApprovalFlow',
        row.id,
        flowFields(row),
      );
      return row;
    });
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, async (tx) => {
      await tx.approvalFlow.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.broadcaster.broadcastDelete(tx, auth.tenantId!, 'ApprovalFlow', id);
    });
  }

  async addStep(auth: AuthContext, flowId: string, dto: CreateApprovalStepDto) {
    await this.findOne(auth, flowId);
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const row = await tx.approvalStep.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          flowId,
          stepOrder: dto.stepOrder,
          approverRole: dto.approverRole as Role,
          limitAmount: dto.limitAmount ?? null,
          limitCurrency: dto.limitCurrency ?? 'USD',
        },
      });
      await this.broadcaster.broadcastUpsert(
        tx,
        auth.tenantId!,
        'ApprovalStep',
        row.id,
        stepFields(row),
      );
      return row;
    });
  }

  async removeStep(auth: AuthContext, flowId: string, stepId: string) {
    await this.findOne(auth, flowId);
    await this.prisma.withTenant(auth.tenantId!, async (tx) => {
      await tx.approvalStep.updateMany({
        where: { id: stepId, flowId, tenantId: auth.tenantId! },
        data: { deletedAt: new Date() },
      });
      await this.broadcaster.broadcastDelete(tx, auth.tenantId!, 'ApprovalStep', stepId);
    });
  }
}
