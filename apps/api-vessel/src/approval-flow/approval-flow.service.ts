import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { approvalFlows, approvalSteps, type Role } from '../db/schema';
import type { CreateApprovalFlowDto } from './dto/create-approval-flow.dto';
import type { CreateApprovalStepDto } from './dto/create-approval-step.dto';
import type { UpdateApprovalFlowDto } from './dto/update-approval-flow.dto';

@Injectable()
export class ApprovalFlowService {
  constructor(private readonly drizzle: DrizzleService) {}

  create(auth: AuthContext, dto: CreateApprovalFlowDto) {
    const [row] = this.drizzle.db
      .insert(approvalFlows)
      .values({
        id: newId(),
        tenantId: auth.tenantId,
        name: dto.name,
        description: dto.description ?? null,
        isActive: dto.isActive ?? true,
      })
      .returning()
      .all();
    return row;
  }

  findAll(auth: AuthContext) {
    const flows = this.drizzle.db
      .select()
      .from(approvalFlows)
      .where(and(eq(approvalFlows.tenantId, auth.tenantId), isNull(approvalFlows.deletedAt)))
      .orderBy(approvalFlows.name)
      .all();
    return flows.map((f) => ({
      ...f,
      steps: this.drizzle.db
        .select()
        .from(approvalSteps)
        .where(and(eq(approvalSteps.flowId, f.id), isNull(approvalSteps.deletedAt)))
        .orderBy(approvalSteps.stepOrder)
        .all(),
    }));
  }

  findOne(auth: AuthContext, id: string) {
    const flow = this.drizzle.db
      .select()
      .from(approvalFlows)
      .where(
        and(
          eq(approvalFlows.id, id),
          eq(approvalFlows.tenantId, auth.tenantId),
          isNull(approvalFlows.deletedAt),
        ),
      )
      .get();
    if (flow === undefined) throw new NotFoundException(`ApprovalFlow ${id} not found`);
    const steps = this.drizzle.db
      .select()
      .from(approvalSteps)
      .where(and(eq(approvalSteps.flowId, id), isNull(approvalSteps.deletedAt)))
      .orderBy(approvalSteps.stepOrder)
      .all();
    return { ...flow, steps };
  }

  update(auth: AuthContext, id: string, dto: UpdateApprovalFlowDto) {
    this.findOne(auth, id);
    const [row] = this.drizzle.db
      .update(approvalFlows)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(approvalFlows.id, id))
      .returning()
      .all();
    return row;
  }

  softDelete(auth: AuthContext, id: string) {
    this.findOne(auth, id);
    this.drizzle.db
      .update(approvalFlows)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(approvalFlows.id, id))
      .run();
  }

  addStep(auth: AuthContext, flowId: string, dto: CreateApprovalStepDto) {
    this.findOne(auth, flowId);
    const [row] = this.drizzle.db
      .insert(approvalSteps)
      .values({
        id: newId(),
        tenantId: auth.tenantId,
        flowId,
        stepOrder: dto.stepOrder,
        approverRole: dto.approverRole as Role,
        limitAmount: dto.limitAmount ?? null,
        limitCurrency: dto.limitCurrency ?? 'USD',
      })
      .returning()
      .all();
    return row;
  }

  removeStep(auth: AuthContext, flowId: string, stepId: string) {
    this.findOne(auth, flowId);
    this.drizzle.db
      .update(approvalSteps)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(and(eq(approvalSteps.id, stepId), eq(approvalSteps.flowId, flowId)))
      .run();
  }
}
