import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth-context';
import { requireVesselId } from '../auth/vessel-bound';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxRecorder } from '../sync/outbox-recorder';
import type { CreateRfqDto } from './dto/create-rfq.dto';
import type { UpdateRfqDto } from './dto/update-rfq.dto';

const ENTITY_TYPE = 'Rfq';

@Injectable()
export class RfqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recorder: OutboxRecorder,
  ) {}

  async create(auth: AuthContext, dto: CreateRfqDto) {
    const vesselId = requireVesselId(auth);
    const id = newId();
    return this.prisma.withTenant(auth.tenantId!, async (tx) => {
      const fields = { vesselId, title: dto.title, status: 'DRAFT' as const };
      const { hlc } = await this.recorder.recordUpsert(
        tx as unknown as Prisma.TransactionClient,
        { tenantId: auth.tenantId!, vesselId },
        ENTITY_TYPE,
        id,
        fields,
      );
      return tx.rfq.create({
        data: {
          id,
          tenantId: auth.tenantId!,
          vesselId,
          title: dto.title,
          notes: dto.notes ?? null,
          status: 'DRAFT',
          requisitionId: dto.requisitionId ?? null,
          createdByUserId: auth.userId,
          issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
          hlc,
        },
      });
    });
  }

  findAll(auth: AuthContext) {
    const vesselId = requireVesselId(auth);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.rfq.findMany({
        where: { tenantId: auth.tenantId!, vesselId, deletedAt: null },
        include: { quotes: { where: { deletedAt: null } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const vesselId = requireVesselId(auth);
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.rfq.findFirst({
        where: { id, tenantId: auth.tenantId!, vesselId, deletedAt: null },
        include: { quotes: { where: { deletedAt: null }, include: { lines: true } } },
      }),
    );
    if (row === null) throw new NotFoundException(`RFQ ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateRfqDto) {
    const rfq = await this.findOne(auth, id);
    if (rfq.status === 'CLOSED') throw new BadRequestException('Closed RFQs cannot be updated');
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.rfq.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.issuedAt !== undefined && {
            issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
          }),
          ...(dto.dueAt !== undefined && { dueAt: dto.dueAt ? new Date(dto.dueAt) : null }),
        },
      }),
    );
  }

  async send(auth: AuthContext, id: string) {
    const rfq = await this.findOne(auth, id);
    if (rfq.status !== 'DRAFT') throw new BadRequestException('Only DRAFT RFQs can be sent');
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.rfq.update({
        where: { id },
        data: { status: 'SENT', issuedAt: new Date() },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.rfq.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
