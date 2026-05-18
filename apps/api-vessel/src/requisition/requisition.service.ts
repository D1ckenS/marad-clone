import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { DrizzleService } from '../db/drizzle.service';
import { approvalSteps, requisitionLines, requisitions } from '../db/schema';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateRequisitionDto } from './dto/create-requisition.dto';
import type { CreateRequisitionLineDto } from './dto/create-requisition-line.dto';
import type { RejectRequisitionDto } from './dto/reject-requisition.dto';
import type { UpdateRequisitionDto } from './dto/update-requisition.dto';

const ENTITY_TYPE = 'Requisition';
const LINE_ENTITY_TYPE = 'RequisitionLine';

@Injectable()
export class RequisitionService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly recorder: OutboxRecorder,
  ) {}

  create(auth: AuthContext, dto: CreateRequisitionDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();
    return this.drizzle.db.transaction((tx) => {
      const fields = {
        vesselId,
        title: dto.title,
        status: 'DRAFT' as const,
        totalAmount: dto.totalAmount ?? '0',
        requestedAt: dto.requestedAt,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      const [row] = tx
        .insert(requisitions)
        .values({
          id,
          tenantId: auth.tenantId,
          vesselId,
          title: dto.title,
          notes: dto.notes ?? null,
          status: 'DRAFT',
          totalAmount: dto.totalAmount ?? '0',
          currency: dto.currency ?? 'USD',
          requestedByUserId: auth.userId,
          requestedAt: dto.requestedAt,
          approvalFlowId: dto.approvalFlowId ?? null,
          hlc,
        })
        .returning()
        .all();
      return row;
    });
  }

  findAll(auth: AuthContext, status?: string) {
    const vesselId = requireVesselId(auth);
    const rows = this.drizzle.db
      .select()
      .from(requisitions)
      .where(
        and(
          eq(requisitions.tenantId, auth.tenantId),
          eq(requisitions.vesselId, vesselId),
          isNull(requisitions.deletedAt),
          ...(status ? [eq(requisitions.status, status as never)] : []),
        ),
      )
      .orderBy(requisitions.requestedAt)
      .all();
    return rows.map((r) => ({
      ...r,
      lines: this.drizzle.db
        .select()
        .from(requisitionLines)
        .where(and(eq(requisitionLines.requisitionId, r.id), isNull(requisitionLines.deletedAt)))
        .all(),
    }));
  }

  findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const row = this.drizzle.db
      .select()
      .from(requisitions)
      .where(
        and(
          eq(requisitions.id, id),
          eq(requisitions.tenantId, auth.tenantId),
          eq(requisitions.vesselId, vesselId),
          isNull(requisitions.deletedAt),
        ),
      )
      .get();
    if (row === undefined) throw new NotFoundException(`Requisition ${id} not found`);
    const lines = this.drizzle.db
      .select()
      .from(requisitionLines)
      .where(and(eq(requisitionLines.requisitionId, id), isNull(requisitionLines.deletedAt)))
      .all();
    return { ...row, lines };
  }

  update(auth: AuthContext, id: string, dto: UpdateRequisitionDto) {
    const req = this.findOne(auth, id);
    if (req.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT requisitions can be updated');
    const [row] = this.drizzle.db
      .update(requisitions)
      .set({
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.totalAmount !== undefined && { totalAmount: dto.totalAmount }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.approvalFlowId !== undefined && { approvalFlowId: dto.approvalFlowId }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(requisitions.id, id))
      .returning()
      .all();
    return row;
  }

  softDelete(auth: AuthContext, id: string) {
    const req = this.findOne(auth, id);
    if (req.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT requisitions can be deleted');
    this.drizzle.db
      .update(requisitions)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(requisitions.id, id))
      .run();
  }

  addLine(auth: AuthContext, requisitionId: string, dto: CreateRequisitionLineDto) {
    const req = this.findOne(auth, requisitionId);
    if (req.status !== 'DRAFT')
      throw new BadRequestException('Lines can only be added to DRAFT requisitions');
    const vesselId = requireVesselId(auth);
    const id = newId();
    return this.drizzle.db.transaction((tx) => {
      const fields = {
        vesselId,
        requisitionId,
        description: dto.description,
        quantity: dto.quantity,
      };
      const { hlc } = this.recorder.recordUpsert(
        tx,
        { tenantId: auth.tenantId, vesselId },
        LINE_ENTITY_TYPE,
        id,
        fields,
      );
      const [row] = tx
        .insert(requisitionLines)
        .values({
          id,
          tenantId: auth.tenantId,
          vesselId,
          requisitionId,
          partId: dto.partId ?? null,
          description: dto.description,
          quantity: dto.quantity,
          unit: dto.unit ?? 'pcs',
          estimatedUnitPrice: dto.estimatedUnitPrice ?? null,
          estimatedTotalPrice: dto.estimatedTotalPrice ?? null,
          currency: dto.currency ?? null,
          notes: dto.notes ?? null,
          hlc,
        })
        .returning()
        .all();
      return row;
    });
  }

  removeLine(auth: AuthContext, requisitionId: string, lineId: string) {
    const req = this.findOne(auth, requisitionId);
    if (req.status !== 'DRAFT')
      throw new BadRequestException('Lines can only be removed from DRAFT requisitions');
    this.drizzle.db
      .update(requisitionLines)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(
        and(eq(requisitionLines.id, lineId), eq(requisitionLines.requisitionId, requisitionId)),
      )
      .run();
  }

  submit(auth: AuthContext, id: string) {
    const req = this.findOne(auth, id);
    if (req.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT requisitions can be submitted');

    let firstStepOrder = 0;
    if (req.approvalFlowId) {
      const steps = this.drizzle.db
        .select()
        .from(approvalSteps)
        .where(and(eq(approvalSteps.flowId, req.approvalFlowId), isNull(approvalSteps.deletedAt)))
        .orderBy(approvalSteps.stepOrder)
        .all();
      if (steps.length > 0) firstStepOrder = steps[0]!.stepOrder;
    }

    const [row] = this.drizzle.db
      .update(requisitions)
      .set({
        status: 'SUBMITTED',
        currentStepOrder: firstStepOrder,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(requisitions.id, id))
      .returning()
      .all();
    return row;
  }

  approve(auth: AuthContext, id: string) {
    const req = this.findOne(auth, id);
    if (req.status !== 'SUBMITTED')
      throw new BadRequestException('Only SUBMITTED requisitions can be approved');

    if (req.approvalFlowId) {
      const steps = this.drizzle.db
        .select()
        .from(approvalSteps)
        .where(and(eq(approvalSteps.flowId, req.approvalFlowId), isNull(approvalSteps.deletedAt)))
        .orderBy(approvalSteps.stepOrder)
        .all();
      const currentStep = steps.find((s) => s.stepOrder === req.currentStepOrder);
      if (!currentStep)
        throw new ForbiddenException('No active approval step found for this requisition');
      if (currentStep.approverRole !== auth.role)
        throw new ForbiddenException(
          `This step requires role ${currentStep.approverRole}, you have ${auth.role}`,
        );
      if (
        currentStep.limitAmount !== null &&
        parseFloat(req.totalAmount ?? '0') > parseFloat(currentStep.limitAmount)
      ) {
        throw new ForbiddenException(
          `Requisition amount ${req.totalAmount} exceeds your approval limit of ${currentStep.limitAmount} ${currentStep.limitCurrency}`,
        );
      }

      const nextStep = steps.find((s) => s.stepOrder > req.currentStepOrder);
      if (nextStep) {
        const [row] = this.drizzle.db
          .update(requisitions)
          .set({ currentStepOrder: nextStep.stepOrder, updatedAt: new Date().toISOString() })
          .where(eq(requisitions.id, id))
          .returning()
          .all();
        return row;
      }
    }

    const [row] = this.drizzle.db
      .update(requisitions)
      .set({
        status: 'APPROVED',
        approvedByUserId: auth.userId,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(requisitions.id, id))
      .returning()
      .all();
    return row;
  }

  reject(auth: AuthContext, id: string, dto: RejectRequisitionDto) {
    const req = this.findOne(auth, id);
    if (req.status !== 'SUBMITTED')
      throw new BadRequestException('Only SUBMITTED requisitions can be rejected');
    const [row] = this.drizzle.db
      .update(requisitions)
      .set({
        status: 'REJECTED',
        rejectedByUserId: auth.userId,
        rejectedAt: new Date().toISOString(),
        rejectionReason: dto.reason ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(requisitions.id, id))
      .returning()
      .all();
    return row;
  }
}
