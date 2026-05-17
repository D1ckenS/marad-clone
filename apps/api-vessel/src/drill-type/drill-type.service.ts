import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { drillTypes } from '../db/schema';
import type { CreateDrillTypeDto, UpdateDrillTypeDto } from './dto/create-drill-type.dto';

@Injectable()
export class DrillTypeService {
  constructor(private readonly drizzle: DrizzleService) {}

  create(auth: AuthContext, dto: CreateDrillTypeDto) {
    const id = newId();
    const nowIso = new Date().toISOString();
    const [row] = this.drizzle.db
      .insert(drillTypes)
      .values({
        id,
        tenantId: auth.tenantId,
        name: dto.name,
        description: dto.description ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .returning()
      .all();
    return row;
  }

  findAll(auth: AuthContext) {
    return this.drizzle.db
      .select()
      .from(drillTypes)
      .where(and(eq(drillTypes.tenantId, auth.tenantId), isNull(drillTypes.deletedAt)))
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(drillTypes)
      .where(
        and(
          eq(drillTypes.id, id),
          eq(drillTypes.tenantId, auth.tenantId),
          isNull(drillTypes.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`DrillType ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateDrillTypeDto) {
    this.findOne(auth, id);
    const [row] = this.drizzle.db
      .update(drillTypes)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(drillTypes.id, id))
      .returning()
      .all();
    return row;
  }

  softDelete(auth: AuthContext, id: string) {
    this.findOne(auth, id);
    this.drizzle.db
      .update(drillTypes)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(drillTypes.id, id))
      .run();
  }
}
