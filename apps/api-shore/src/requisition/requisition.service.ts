import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { PrismaService } from '../prisma/prisma.service';
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
    private readonly prisma: PrismaService,
    private readonly recorder: OutboxRecorder,
  ) {}

  async create(auth: AuthContext, dto: CreateRequisitionDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const fields = {
        vesselId,
        title: dto.title,
        status: 'DRAFT' as const,
        totalAmount: dto.totalAmount ?? '0',
        currency: dto.currency ?? 'USD',
        requestedAt: dto.requestedAt,
        approvalFlowId: dto.approvalFlowId ?? null,
      };
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId!, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      return tx.requisition.create({
        data: {
          id,
          tenantId: auth.tenantId!,
          vesselId,
          title: dto.title,
          notes: dto.notes ?? null,
          status: 'DRAFT',
          totalAmount: new Prisma.Decimal(dto.totalAmount ?? '0'),
          currency: dto.currency ?? 'USD',
          requestedByUserId: auth.userId ?? null,
          requestedAt: new Date(dto.requestedAt),
          approvalFlowId: dto.approvalFlowId ?? null,
          hlc,
        },
      });
    });
  }

  findAll(auth: AuthContext, status?: string) {
    const vesselId = requireVesselId(auth);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.requisition.findMany({
        where: {
          tenantId: auth.tenantId!,
          vesselId,
          deletedAt: null,
          ...(status && { status: status as never }),
        },
        include: { lines: { where: { deletedAt: null } } },
        orderBy: { requestedAt: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.requisition.findFirst({
        where: { id, tenantId: auth.tenantId!, vesselId, deletedAt: null },
        include: { lines: { where: { deletedAt: null } }, approvalFlow: true },
      }),
    );
    if (row === null) throw new NotFoundException(`Requisition ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateRequisitionDto) {
    const req = await this.findOne(auth, id);
    if (req.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT requisitions can be updated');
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.requisition.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.totalAmount !== undefined && {
            totalAmount: new Prisma.Decimal(dto.totalAmount),
          }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
          ...(dto.approvalFlowId !== undefined && { approvalFlowId: dto.approvalFlowId }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    const req = await this.findOne(auth, id);
    if (req.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT requisitions can be deleted');
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.requisition.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }

  async addLine(auth: AuthContext, requisitionId: string, dto: CreateRequisitionLineDto) {
    const req = await this.findOne(auth, requisitionId);
    if (req.status !== 'DRAFT')
      throw new BadRequestException('Lines can only be added to DRAFT requisitions');
    const vesselId = requireVesselId(auth);
    const id = newId();
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const fields = {
        vesselId,
        requisitionId,
        description: dto.description,
        quantity: dto.quantity,
      };
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId!, vesselId },
        LINE_ENTITY_TYPE,
        id,
        fields,
      );
      return tx.requisitionLine.create({
        data: {
          id,
          tenantId: auth.tenantId!,
          vesselId,
          requisitionId,
          partId: dto.partId ?? null,
          description: dto.description,
          quantity: new Prisma.Decimal(dto.quantity),
          unit: dto.unit ?? 'pcs',
          estimatedUnitPrice: dto.estimatedUnitPrice
            ? new Prisma.Decimal(dto.estimatedUnitPrice)
            : null,
          estimatedTotalPrice: dto.estimatedTotalPrice
            ? new Prisma.Decimal(dto.estimatedTotalPrice)
            : null,
          currency: dto.currency ?? null,
          notes: dto.notes ?? null,
          hlc,
        },
      });
    });
  }

  async removeLine(auth: AuthContext, requisitionId: string, lineId: string) {
    const req = await this.findOne(auth, requisitionId);
    if (req.status !== 'DRAFT')
      throw new BadRequestException('Lines can only be removed from DRAFT requisitions');
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.requisitionLine.updateMany({
        where: { id: lineId, requisitionId, tenantId: auth.tenantId! },
        data: { deletedAt: new Date() },
      }),
    );
  }

  async submit(auth: AuthContext, id: string) {
    const req = await this.findOne(auth, id);
    if (req.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT requisitions can be submitted');

    let firstStepOrder = 0;
    if (req.approvalFlowId) {
      const steps = await this.prisma.withTenant(auth.tenantId!, (tx) =>
        tx.approvalStep.findMany({
          where: { flowId: req.approvalFlowId!, tenantId: auth.tenantId!, deletedAt: null },
          orderBy: { stepOrder: 'asc' },
        }),
      );
      if (steps.length > 0) firstStepOrder = steps[0]!.stepOrder;
    }

    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.requisition.update({
        where: { id },
        data: { status: 'SUBMITTED', currentStepOrder: firstStepOrder },
      }),
    );
  }

  async approve(auth: AuthContext, id: string) {
    const req = await this.findOne(auth, id);
    if (req.status !== 'SUBMITTED')
      throw new BadRequestException('Only SUBMITTED requisitions can be approved');

    if (req.approvalFlow) {
      const steps = await this.prisma.withTenant(auth.tenantId!, (tx) =>
        tx.approvalStep.findMany({
          where: { flowId: req.approvalFlowId!, tenantId: auth.tenantId!, deletedAt: null },
          orderBy: { stepOrder: 'asc' },
        }),
      );
      const currentStep = steps.find((s) => s.stepOrder === req.currentStepOrder);
      if (!currentStep)
        throw new ForbiddenException('No active approval step found for this requisition');
      if (currentStep.approverRole !== auth.role)
        throw new ForbiddenException(
          `This step requires role ${currentStep.approverRole}, you have ${auth.role}`,
        );
      if (
        currentStep.limitAmount !== null &&
        req.totalAmount.greaterThan(currentStep.limitAmount)
      ) {
        throw new ForbiddenException(
          `Requisition amount ${req.totalAmount} exceeds your approval limit of ${currentStep.limitAmount} ${currentStep.limitCurrency}`,
        );
      }

      // Check if there are more steps after this one
      const nextStep = steps.find((s) => s.stepOrder > req.currentStepOrder);
      if (nextStep) {
        // Advance to next step — remain SUBMITTED
        return this.prisma.withTenant(auth.tenantId!, (tx) =>
          tx.requisition.update({
            where: { id },
            data: { currentStepOrder: nextStep.stepOrder },
          }),
        );
      }
    }

    // No more steps (or no flow) — fully approved
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.requisition.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedByUserId: auth.userId ?? null,
          approvedAt: new Date(),
        },
      }),
    );
  }

  async reject(auth: AuthContext, id: string, dto: RejectRequisitionDto) {
    const req = await this.findOne(auth, id);
    if (req.status !== 'SUBMITTED')
      throw new BadRequestException('Only SUBMITTED requisitions can be rejected');
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.requisition.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedByUserId: auth.userId ?? null,
          rejectedAt: new Date(),
          rejectionReason: dto.reason ?? null,
        },
      }),
    );
  }
}
