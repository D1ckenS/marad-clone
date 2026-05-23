import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateSafetyEquipmentDto,
  UpdateSafetyEquipmentDto,
} from './dto/safety-equipment.dto';

@Injectable()
export class SafetyEquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  create(auth: AuthContext, dto: CreateSafetyEquipmentDto) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.safetyEquipment.create({
        data: {
          id: newId(),
          tenantId: auth.tenantId!,
          vesselId: dto.vesselId,
          category: dto.category,
          name: dto.name,
          location: dto.location,
          quantity: dto.quantity,
          lastCheck: dto.lastCheck ? new Date(dto.lastCheck) : null,
          nextCheck: dto.nextCheck ? new Date(dto.nextCheck) : null,
          status: dto.status ?? 'GREEN',
          flag: dto.flag ?? null,
        },
      }),
    );
  }

  findAll(auth: AuthContext, query: { vesselId?: string; category?: string }) {
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.safetyEquipment.findMany({
        where: {
          tenantId: auth.tenantId!,
          deletedAt: null,
          ...(query.vesselId && { vesselId: query.vesselId }),
          ...(query.category && { category: query.category as never }),
        },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
    );
  }

  async findOne(auth: AuthContext, id: string) {
    const row = await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.safetyEquipment.findFirst({
        where: { id, tenantId: auth.tenantId!, deletedAt: null },
      }),
    );
    if (!row) throw new NotFoundException(`SafetyEquipment ${id} not found`);
    return row;
  }

  async update(auth: AuthContext, id: string, dto: UpdateSafetyEquipmentDto) {
    await this.findOne(auth, id);
    return this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.safetyEquipment.update({
        where: { id },
        data: {
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.location !== undefined && { location: dto.location }),
          ...(dto.quantity !== undefined && { quantity: dto.quantity }),
          ...(dto.lastCheck !== undefined && {
            lastCheck: dto.lastCheck === null ? null : new Date(dto.lastCheck),
          }),
          ...(dto.nextCheck !== undefined && {
            nextCheck: dto.nextCheck === null ? null : new Date(dto.nextCheck),
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.flag !== undefined && { flag: dto.flag }),
        },
      }),
    );
  }

  async softDelete(auth: AuthContext, id: string) {
    await this.findOne(auth, id);
    await this.prisma.withTenant(auth.tenantId!, (tx) =>
      tx.safetyEquipment.update({ where: { id }, data: { deletedAt: new Date() } }),
    );
  }
}
