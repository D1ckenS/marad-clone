import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { fuelProducts } from '../db/schema';
import type { CreateFuelProductDto, UpdateFuelProductDto } from './dto/create-fuel-product.dto';

@Injectable()
export class FuelProductService {
  constructor(private readonly drizzle: DrizzleService) {}

  create(auth: AuthContext, dto: CreateFuelProductDto) {
    const nowIso = new Date().toISOString();
    const [row] = this.drizzle.db
      .insert(fuelProducts)
      .values({
        id: newId(),
        tenantId: auth.tenantId,
        name: dto.name,
        tankType: dto.tankType as never,
        sulphurPct: dto.sulphurPct ?? null,
        densityKgM3: dto.densityKgM3 ?? null,
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
      .from(fuelProducts)
      .where(and(eq(fuelProducts.tenantId, auth.tenantId), isNull(fuelProducts.deletedAt)))
      .orderBy(fuelProducts.name)
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(fuelProducts)
      .where(
        and(
          eq(fuelProducts.id, id),
          eq(fuelProducts.tenantId, auth.tenantId),
          isNull(fuelProducts.deletedAt),
        ),
      )
      .get();
    if (!row) throw new NotFoundException(`FuelProduct ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateFuelProductDto) {
    this.findOne(auth, id);
    const fields: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (dto.name !== undefined) fields['name'] = dto.name;
    if (dto.tankType !== undefined) fields['tankType'] = dto.tankType;
    if (dto.sulphurPct !== undefined) fields['sulphurPct'] = dto.sulphurPct ?? null;
    if (dto.densityKgM3 !== undefined) fields['densityKgM3'] = dto.densityKgM3 ?? null;
    const [row] = this.drizzle.db
      .update(fuelProducts)
      .set(fields as never)
      .where(eq(fuelProducts.id, id))
      .returning()
      .all();
    return row;
  }

  softDelete(auth: AuthContext, id: string) {
    this.findOne(auth, id);
    this.drizzle.db
      .update(fuelProducts)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(fuelProducts.id, id))
      .run();
  }
}
