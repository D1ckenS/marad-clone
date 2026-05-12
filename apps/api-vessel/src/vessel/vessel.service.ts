import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import { DrizzleService } from '../db/drizzle.service';
import { vessels } from '../db/schema';
import type { CreateVesselDto } from './dto/create-vessel.dto';

@Injectable()
export class VesselService {
  constructor(private readonly drizzle: DrizzleService) {}

  create(tenantId: string, dto: CreateVesselDto) {
    const [vessel] = this.drizzle.db
      .insert(vessels)
      .values({
        id: newId(),
        tenantId,
        name: dto.name,
        imoNumber: dto.imoNumber ?? null,
      })
      .returning()
      .all();
    return vessel;
  }

  findById(tenantId: string, id: string) {
    const vessel = this.drizzle.db
      .select()
      .from(vessels)
      .where(and(eq(vessels.id, id), eq(vessels.tenantId, tenantId)))
      .get();
    if (!vessel) throw new NotFoundException(`Vessel ${id} not found`);
    return vessel;
  }

  findByTenant(tenantId: string) {
    return this.drizzle.db.select().from(vessels).where(eq(vessels.tenantId, tenantId)).all();
  }
}
