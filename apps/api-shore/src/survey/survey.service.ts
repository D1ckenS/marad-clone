import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSurveyDto, UpdateSurveyDto } from './dto/survey.dto';

@Injectable()
export class SurveyService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateSurveyDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.survey.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          scheduledAt: new Date(dto.scheduledAt),
          kind: dto.kind,
          scope: dto.scope,
          surveyor: dto.surveyor,
          location: dto.location,
          status: dto.status ?? 'SCHEDULED',
          certificateId: dto.certificateId ?? null,
          notes: dto.notes ?? null,
        },
      }),
    );
  }

  findAll(auth: AuthContext, query: { vesselId?: string; status?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.survey.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.status && { status: query.status as never }),
        },
        orderBy: { scheduledAt: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.survey.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
      }),
    );
    if (!row) throw new NotFoundException(`Survey ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateSurveyDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.survey.update({
        where: { id },
        data: {
          ...(dto.scheduledAt !== undefined && { scheduledAt: new Date(dto.scheduledAt) }),
          ...(dto.kind !== undefined && { kind: dto.kind }),
          ...(dto.scope !== undefined && { scope: dto.scope }),
          ...(dto.surveyor !== undefined && { surveyor: dto.surveyor }),
          ...(dto.location !== undefined && { location: dto.location }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.certificateId !== undefined && { certificateId: dto.certificateId }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.survey.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
