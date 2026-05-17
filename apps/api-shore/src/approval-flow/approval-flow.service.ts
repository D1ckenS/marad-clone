import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { Role } from '@prisma/client';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateApprovalFlowDto } from './dto/create-approval-flow.dto';
import type { CreateApprovalStepDto } from './dto/create-approval-step.dto';
import type { UpdateApprovalFlowDto } from './dto/update-approval-flow.dto';

@Injectable()
export class ApprovalFlowService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateApprovalFlowDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.approvalFlow.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          name: dto.name,
          description: dto.description ?? null,
          isActive: dto.isActive ?? true,
        },
      }),
    );
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
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.approvalFlow.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.approvalFlow.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }

  async addStep(auth: AuthContext, flowId: string, dto: CreateApprovalStepDto) {
    await this.findOne(auth, flowId);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.approvalStep.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          flowId,
          stepOrder: dto.stepOrder,
          approverRole: dto.approverRole as Role,
          limitAmount: dto.limitAmount ?? null,
          limitCurrency: dto.limitCurrency ?? 'USD',
        },
      }),
    );
  }

  async removeStep(auth: AuthContext, flowId: string, stepId: string) {
    await this.findOne(auth, flowId);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.approvalStep.updateMany({
        where: { id: stepId, flowId, tenantId: auth.tenantId! },
        data: { deletedAt: new Date() },
      }),
    );
  }
}
