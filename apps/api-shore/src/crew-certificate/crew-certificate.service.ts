import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateCrewCertificateDto,
  UpdateCrewCertificateDto,
} from './dto/create-crew-certificate.dto';

@Injectable()
export class CrewCertificateService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateCrewCertificateDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.crewCertificate.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          crewMemberId: dto.crewMemberId,
          certificateType: dto.certificateType,
          number: dto.number ?? null,
          issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          issuedBy: dto.issuedBy ?? null,
          notes: dto.notes ?? null,
        },
      }),
    );
  }

  findAll(auth: AuthContext, query: { vesselId?: string; crewMemberId?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.crewCertificate.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.crewMemberId && { crewMemberId: query.crewMemberId }),
        },
        orderBy: { expiresAt: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.crewCertificate.findFirst({ where: { id, tenantId: auth.tenantId!, deletedAt: null } }),
    );
    if (!row) throw new NotFoundException(`CrewCertificate ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateCrewCertificateDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.crewCertificate.update({
        where: { id },
        data: {
          ...(dto.certificateType !== undefined && { certificateType: dto.certificateType }),
          ...(dto.number !== undefined && { number: dto.number }),
          ...(dto.issuedAt !== undefined && {
            issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
          }),
          ...(dto.expiresAt !== undefined && {
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          }),
          ...(dto.issuedBy !== undefined && { issuedBy: dto.issuedBy }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.crewCertificate.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
