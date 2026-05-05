import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@marad-clone/domain';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateVesselDto } from './dto/create-vessel.dto';

@Injectable()
export class VesselService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateVesselDto) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.vessel.create({
        data: { id: newId(), tenantId, name: dto.name, imoNumber: dto.imoNumber ?? null },
      }),
    );
  }

  async findById(tenantId: string, id: string) {
    const vessel = await this.prisma.withTenant(tenantId, (tx) =>
      tx.vessel.findUnique({ where: { id } }),
    );
    if (!vessel) throw new NotFoundException(`Vessel ${id} not found`);
    return vessel;
  }

  findByTenant(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) => tx.vessel.findMany({ where: { tenantId } }));
  }
}
