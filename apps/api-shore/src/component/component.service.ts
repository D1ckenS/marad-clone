import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@marad-clone/domain';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateComponentDto } from './dto/create-component.dto';
import type { UpdateComponentDto } from './dto/update-component.dto';

const ENTITY_TYPE = 'Component';

@Injectable()
export class ComponentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recorder: OutboxRecorder,
  ) {}

  async create(auth: AuthContext, dto: CreateComponentDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();
    const runningHours = dto.runningHours ?? '0';

    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const fields = {
        name: dto.name,
        description: dto.description ?? null,
        sfi: dto.sfi ?? null,
        parentId: dto.parentId ?? null,
        masterId: dto.masterId ?? null,
        runningHours,
        vesselId,
      };
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      return tx.component.create({
        data: {
          id,
          tenantId: auth.tenantId,
          vesselId,
          name: dto.name,
          description: dto.description ?? null,
          sfi: dto.sfi ?? null,
          parentId: dto.parentId ?? null,
          masterId: dto.masterId ?? null,
          runningHours: new Prisma.Decimal(runningHours),
          hlc,
        },
      });
    });
  }

  async findAll(auth: AuthContext) {
    const vesselId = requireVesselId(auth);
    return this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.component.findMany({
        where: { tenantId: auth.tenantId, vesselId, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const row = await this.prisma.withTenant(auth.tenantId, (tx) =>
      tx.component.findFirst({
        where: { id, tenantId: auth.tenantId, vesselId, deletedAt: null },
      }),
    );
    if (row === null) throw new NotFoundException(`Component ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateComponentDto) {
    const vesselId = requireVesselId(auth);
    await this.findOne(auth, id); // 404 + RLS check before mutating

    const fields: Record<string, unknown> = {};
    if (dto.name !== undefined) fields['name'] = dto.name;
    if (dto.description !== undefined) fields['description'] = dto.description;
    if (dto.sfi !== undefined) fields['sfi'] = dto.sfi;
    if (dto.parentId !== undefined) fields['parentId'] = dto.parentId;
    if (dto.runningHours !== undefined) fields['runningHours'] = dto.runningHours;

    return this.prisma.withTenant(auth.tenantId, async (tx) => {
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      return tx.component.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.sfi !== undefined && { sfi: dto.sfi }),
          ...(dto.parentId !== undefined && { parentId: dto.parentId }),
          ...(dto.runningHours !== undefined && {
            runningHours: new Prisma.Decimal(dto.runningHours),
          }),
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
      await tx.component.update({
        where: { id },
        data: { deletedAt: new Date(), hlc },
      });
    });
  }
}
