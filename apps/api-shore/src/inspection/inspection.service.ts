import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateInspectionDto, UpdateInspectionDto } from './dto/inspection.dto';

@Injectable()
export class InspectionService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateInspectionDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.inspection.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          inspectedAt: new Date(dto.inspectedAt),
          kind: dto.kind,
          mou: dto.mou ?? null,
          port: dto.port,
          inspector: dto.inspector,
          deficiencies: dto.deficiencies ?? 0,
          detained: dto.detained ?? false,
          status: dto.status,
          findings: dto.findings ?? null,
        },
      }),
    );
  }

  findAll(auth: AuthContext, query: { vesselId?: string; kind?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.inspection.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.kind && { kind: query.kind as never }),
        },
        orderBy: { inspectedAt: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.inspection.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
      }),
    );
    if (!row) throw new NotFoundException(`Inspection ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateInspectionDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.inspection.update({
        where: { id },
        data: {
          ...(dto.inspectedAt !== undefined && { inspectedAt: new Date(dto.inspectedAt) }),
          ...(dto.kind !== undefined && { kind: dto.kind }),
          ...(dto.mou !== undefined && { mou: dto.mou }),
          ...(dto.port !== undefined && { port: dto.port }),
          ...(dto.inspector !== undefined && { inspector: dto.inspector }),
          ...(dto.deficiencies !== undefined && { deficiencies: dto.deficiencies }),
          ...(dto.detained !== undefined && { detained: dto.detained }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.findings !== undefined && { findings: dto.findings }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.inspection.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
