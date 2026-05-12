import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@marad-clone/domain';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateJobInstanceDto } from './dto/create-job-instance.dto';
import type { UpdateJobInstanceDto } from './dto/update-job-instance.dto';

const ENTITY_TYPE = 'JobInstance';

@Injectable()
export class JobInstanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recorder: OutboxRecorder,
  ) {}

  async create(auth: AuthContext, dto: CreateJobInstanceDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();

    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const fields = {
        jobId: dto.jobId,
        componentId: dto.componentId,
        status: dto.status ?? 'PENDING',
        dueAt: dto.dueAt ?? null,
        dueAtRunningHours: dto.dueAtRunningHours ?? null,
        assignedToUserId: dto.assignedToUserId ?? null,
        vesselId,
      };
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      return tx.jobInstance.create({
        data: {
          id,
          tenantId: auth.tenantId,
          vesselId,
          jobId: dto.jobId,
          componentId: dto.componentId,
          status: dto.status ?? 'PENDING',
          dueAt: dto.dueAt !== undefined ? new Date(dto.dueAt) : null,
          dueAtRunningHours:
            dto.dueAtRunningHours !== undefined ? new Prisma.Decimal(dto.dueAtRunningHours) : null,
          assignedToUserId: dto.assignedToUserId ?? null,
          hlc,
        },
      });
    });
  }

  async findAll(auth: AuthContext) {
    const vesselId = requireVesselId(auth);
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.jobInstance.findMany({
        where: { tenantId: auth.tenantId, vesselId, deletedAt: null },
        orderBy: { dueAt: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const row = await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.jobInstance.findFirst({
        where: { id, tenantId: auth.tenantId, vesselId, deletedAt: null },
      }),
    );
    if (row === null) throw new NotFoundException(`JobInstance ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateJobInstanceDto) {
    const vesselId = requireVesselId(auth);
    await this.findOne(auth, id);

    const fields: Record<string, unknown> = {};
    if (dto.status !== undefined) fields['status'] = dto.status;
    if (dto.dueAt !== undefined) fields['dueAt'] = dto.dueAt;
    if (dto.dueAtRunningHours !== undefined) fields['dueAtRunningHours'] = dto.dueAtRunningHours;
    if (dto.assignedToUserId !== undefined) fields['assignedToUserId'] = dto.assignedToUserId;

    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      return tx.jobInstance.update({
        where: { id },
        data: {
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.dueAt !== undefined && { dueAt: new Date(dto.dueAt) }),
          ...(dto.dueAtRunningHours !== undefined && {
            dueAtRunningHours: new Prisma.Decimal(dto.dueAtRunningHours),
          }),
          ...(dto.assignedToUserId !== undefined && { assignedToUserId: dto.assignedToUserId }),
          hlc,
        },
      });
    });
  }

  async softDelete(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const { hlc } = await this.recorder.recordDelete(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
      );
      await tx.jobInstance.update({
        where: { id },
        data: { deletedAt: new Date(), hlc },
      });
    });
  }
}
