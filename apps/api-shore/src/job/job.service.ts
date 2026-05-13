import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateJobDto } from './dto/create-job.dto';
import type { UpdateJobDto } from './dto/update-job.dto';

const ENTITY_TYPE = 'Job';

@Injectable()
export class JobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recorder: OutboxRecorder,
  ) {}

  async create(auth: AuthContext, dto: CreateJobDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();

    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const fields = {
        componentId: dto.componentId,
        title: dto.title,
        description: dto.description ?? null,
        intervalDays: dto.intervalDays ?? null,
        intervalRunningHours: dto.intervalRunningHours ?? null,
        estimatedHours: dto.estimatedHours ?? null,
        priority: dto.priority ?? 'NORMAL',
        typicalPartsJson: dto.typicalPartsJson ?? null,
        vesselId,
      };
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      return tx.job.create({
        data: {
          id,
          tenantId: auth.tenantId,
          vesselId,
          componentId: dto.componentId,
          title: dto.title,
          description: dto.description ?? null,
          intervalDays: dto.intervalDays ?? null,
          intervalRunningHours:
            dto.intervalRunningHours !== undefined
              ? new Prisma.Decimal(dto.intervalRunningHours)
              : null,
          estimatedHours:
            dto.estimatedHours !== undefined ? new Prisma.Decimal(dto.estimatedHours) : null,
          priority: dto.priority ?? 'NORMAL',
          typicalPartsJson: dto.typicalPartsJson ?? null,
          hlc,
        },
      });
    });
  }

  async findAll(auth: AuthContext) {
    const vesselId = requireVesselId(auth);
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.job.findMany({
        where: { tenantId: auth.tenantId, vesselId, deletedAt: null },
        orderBy: { title: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const row = await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.job.findFirst({
        where: { id, tenantId: auth.tenantId, vesselId, deletedAt: null },
      }),
    );
    if (row === null) throw new NotFoundException(`Job ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateJobDto) {
    const vesselId = requireVesselId(auth);
    await this.findOne(auth, id);

    const fields: Record<string, unknown> = {};
    if (dto.title !== undefined) fields['title'] = dto.title;
    if (dto.description !== undefined) fields['description'] = dto.description;
    if (dto.intervalDays !== undefined) fields['intervalDays'] = dto.intervalDays;
    if (dto.intervalRunningHours !== undefined)
      fields['intervalRunningHours'] = dto.intervalRunningHours;
    if (dto.estimatedHours !== undefined) fields['estimatedHours'] = dto.estimatedHours;
    if (dto.priority !== undefined) fields['priority'] = dto.priority;
    if (dto.typicalPartsJson !== undefined) fields['typicalPartsJson'] = dto.typicalPartsJson;

    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      return tx.job.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.intervalDays !== undefined && { intervalDays: dto.intervalDays }),
          ...(dto.intervalRunningHours !== undefined && {
            intervalRunningHours: new Prisma.Decimal(dto.intervalRunningHours),
          }),
          ...(dto.estimatedHours !== undefined && {
            estimatedHours: new Prisma.Decimal(dto.estimatedHours),
          }),
          ...(dto.priority !== undefined && { priority: dto.priority }),
          ...(dto.typicalPartsJson !== undefined && { typicalPartsJson: dto.typicalPartsJson }),
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
      await tx.job.update({
        where: { id },
        data: { deletedAt: new Date(), hlc },
      });
    });
  }
}
