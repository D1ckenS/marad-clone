import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateOcimfInspectionDto } from './dto/create-ocimf-inspection.dto';

@Injectable()
export class OcimfInspectionService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(auth: AuthContext, vesselId?: string) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.ocimfInspection.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(vesselId && { vesselId }),
        },
        orderBy: { inspectionDate: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.ocimfInspection.findFirst({ where: { id, tenantId: auth.tenantId!, deletedAt: null } }),
    );
    if (!row) throw new NotFoundException(`OcimfInspection ${id} not found`);
    return row;
  }

  create(auth: AuthContext, dto: CreateOcimfInspectionDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.ocimfInspection.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          inspectionType: dto.inspectionType,
          inspectionDate: dto.inspectionDate,
          inspector: dto.inspector ?? null,
          port: dto.port ?? null,
          reportNumber: dto.reportNumber ?? null,
          overallScore: dto.overallScore ?? null,
          observationsJson:
            dto.observationsJson !== undefined
              ? (dto.observationsJson as Prisma.InputJsonValue[])
              : Prisma.JsonNull,
        },
      }),
    );
  }

  async update(
    auth: AuthContext,
    id: string,
    dto: Partial<Omit<CreateOcimfInspectionDto, 'vesselId' | 'inspectionType'>>,
  ) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.ocimfInspection.update({
        where: { id },
        data: {
          ...(dto.inspectionDate && { inspectionDate: dto.inspectionDate }),
          ...(dto.inspector !== undefined && { inspector: dto.inspector ?? null }),
          ...(dto.port !== undefined && { port: dto.port ?? null }),
          ...(dto.reportNumber !== undefined && { reportNumber: dto.reportNumber ?? null }),
          ...(dto.overallScore !== undefined && { overallScore: dto.overallScore ?? null }),
          ...(dto.observationsJson !== undefined && {
            observationsJson: dto.observationsJson
              ? (dto.observationsJson as Prisma.InputJsonValue[])
              : Prisma.JsonNull,
          }),
        },
      }),
    );
  }

  async remove(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.ocimfInspection.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
