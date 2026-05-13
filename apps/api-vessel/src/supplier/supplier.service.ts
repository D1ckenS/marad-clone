import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { newId } from '@fleetops/domain';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { suppliers } from '../db/schema';
import type { CreateSupplierDto } from './dto/create-supplier.dto';
import type { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SupplierService {
  constructor(private readonly drizzle: DrizzleService) {}

  create(auth: AuthContext, dto: CreateSupplierDto) {
    const [row] = this.drizzle.db
      .insert(suppliers)
      .values({
        id: newId(),
        tenantId: auth.tenantId,
        name: dto.name,
        contactName: dto.contactName ?? null,
        contactEmail: dto.contactEmail ?? null,
        contactPhone: dto.contactPhone ?? null,
        address: dto.address ?? null,
        country: dto.country ?? null,
        notes: dto.notes ?? null,
        isActive: dto.isActive ?? true,
      })
      .returning()
      .all();
    return row;
  }

  findAll(auth: AuthContext) {
    return this.drizzle.db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.tenantId, auth.tenantId), isNull(suppliers.deletedAt)))
      .orderBy(suppliers.name)
      .all();
  }

  findOne(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.id, id),
          eq(suppliers.tenantId, auth.tenantId),
          isNull(suppliers.deletedAt),
        ),
      )
      .get();
    if (row === undefined) throw new NotFoundException(`Supplier ${id} not found`);
    return row;
  }

  update(auth: AuthContext, id: string, dto: UpdateSupplierDto) {
    this.findOne(auth, id);
    const [row] = this.drizzle.db
      .update(suppliers)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.contactName !== undefined && { contactName: dto.contactName }),
        ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail }),
        ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(suppliers.id, id))
      .returning()
      .all();
    return row;
  }

  softDelete(auth: AuthContext, id: string) {
    this.findOne(auth, id);
    this.drizzle.db
      .update(suppliers)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(suppliers.id, id))
      .run();
  }
}
