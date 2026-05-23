import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateJhaDto, UpdateJhaDto } from './dto/jha.dto';

@Injectable()
export class JhaService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateJhaDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.jha.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          ref: dto.ref,
          title: dto.title,
          activity: dto.activity ?? null,
          hazards: dto.hazards as Prisma.InputJsonValue,
          controls: dto.controls as Prisma.InputJsonValue,
          residualL: dto.residualL ?? 1,
          residualS: dto.residualS ?? 1,
          reviewedAt: dto.reviewedAt ? new Date(dto.reviewedAt) : null,
          reviewedBy: dto.reviewedBy ?? null,
        },
      }),
    );
  }

  findAll(auth: AuthContext) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.jha.findMany({
        where: { tenantId: auth.tenantId!, deletedAt: null },
        orderBy: { ref: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.jha.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
      }),
    );
    if (!row) throw new NotFoundException(`JHA ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateJhaDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.jha.update({
        where: { id },
        data: {
          ...(dto.ref !== undefined && { ref: dto.ref }),
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.activity !== undefined && { activity: dto.activity }),
          ...(dto.hazards !== undefined && { hazards: dto.hazards as Prisma.InputJsonValue }),
          ...(dto.controls !== undefined && { controls: dto.controls as Prisma.InputJsonValue }),
          ...(dto.residualL !== undefined && { residualL: dto.residualL }),
          ...(dto.residualS !== undefined && { residualS: dto.residualS }),
          ...(dto.reviewedAt !== undefined && {
            reviewedAt: dto.reviewedAt === null ? null : new Date(dto.reviewedAt),
          }),
          ...(dto.reviewedBy !== undefined && { reviewedBy: dto.reviewedBy }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.jha.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
