import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCertificateTypeDto } from './dto/create-certificate-type.dto';
import type { UpdateCertificateTypeDto } from './dto/update-certificate-type.dto';

@Injectable()
export class CertificateTypeService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateCertificateTypeDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.certificateType.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          name: dto.name,
          description: dto.description ?? null,
          alertDaysJson: dto.alertDays
            ? JSON.stringify(dto.alertDays)
            : JSON.stringify([90, 60, 30, 7]),
        },
      }),
    );
  }

  findAll(auth: AuthContext) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.certificateType.findMany({
        where: { tenantId: auth.tenantId!, deletedAt: null },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.certificateType.findFirst({ where: { id, tenantId: auth.tenantId!, deletedAt: null } }),
    );
    if (!row) throw new NotFoundException(`CertificateType ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateCertificateTypeDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.certificateType.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.alertDays !== undefined && { alertDaysJson: JSON.stringify(dto.alertDays) }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.certificateType.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
