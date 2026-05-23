import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateConditionOfClassDto,
  UpdateConditionOfClassDto,
} from './dto/condition-of-class.dto';

@Injectable()
export class ConditionOfClassService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateConditionOfClassDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.conditionOfClass.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          severity: dto.severity,
          title: dto.title,
          detail: dto.detail,
          raisedAt: new Date(dto.raisedAt),
          openedAt: new Date(dto.openedAt),
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
          closedAt: dto.closedAt ? new Date(dto.closedAt) : null,
          linkedCertificateId: dto.linkedCertificateId ?? null,
        },
      }),
    );
  }

  findAll(auth: AuthContext, query: { vesselId?: string; severity?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.conditionOfClass.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.severity && { severity: query.severity as never }),
        },
        orderBy: { raisedAt: 'desc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.conditionOfClass.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
      }),
    );
    if (!row) throw new NotFoundException(`ConditionOfClass ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateConditionOfClassDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.conditionOfClass.update({
        where: { id },
        data: {
          ...(dto.severity !== undefined && { severity: dto.severity }),
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.detail !== undefined && { detail: dto.detail }),
          ...(dto.raisedAt !== undefined && { raisedAt: new Date(dto.raisedAt) }),
          ...(dto.openedAt !== undefined && { openedAt: new Date(dto.openedAt) }),
          ...(dto.dueAt !== undefined && {
            dueAt: dto.dueAt === null ? null : new Date(dto.dueAt),
          }),
          ...(dto.closedAt !== undefined && {
            closedAt: dto.closedAt === null ? null : new Date(dto.closedAt),
          }),
          ...(dto.linkedCertificateId !== undefined && {
            linkedCertificateId: dto.linkedCertificateId,
          }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.conditionOfClass.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
