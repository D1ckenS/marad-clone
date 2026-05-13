import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@fleetops/domain';
import { and, eq, isNull } from 'drizzle-orm';
import type { AuthContext } from '../auth/auth-context';
import { DrizzleService } from '../db/drizzle.service';
import { barcodeBindings, parts } from '../db/schema';
import type { CreateBarcodeBindingDto } from './dto/create-barcode-binding.dto';

@Injectable()
export class BarcodeBindingService {
  constructor(private readonly drizzle: DrizzleService) {}

  create(auth: AuthContext, dto: CreateBarcodeBindingDto) {
    const existing = this.drizzle.db
      .select()
      .from(barcodeBindings)
      .where(
        and(
          eq(barcodeBindings.tenantId, auth.tenantId),
          eq(barcodeBindings.barcode, dto.barcode),
          isNull(barcodeBindings.deletedAt),
        ),
      )
      .get();
    if (existing) throw new ConflictException(`Barcode ${dto.barcode} is already bound`);

    const [row] = this.drizzle.db
      .insert(barcodeBindings)
      .values({ id: newId(), tenantId: auth.tenantId, partId: dto.partId, barcode: dto.barcode })
      .returning()
      .all();
    return row;
  }

  lookup(auth: AuthContext, barcode: string) {
    const binding = this.drizzle.db
      .select({
        id: barcodeBindings.id,
        barcode: barcodeBindings.barcode,
        partId: barcodeBindings.partId,
        partName: parts.name,
        partNumber: parts.partNumber,
        unit: parts.unit,
      })
      .from(barcodeBindings)
      .innerJoin(parts, eq(barcodeBindings.partId, parts.id))
      .where(
        and(
          eq(barcodeBindings.tenantId, auth.tenantId),
          eq(barcodeBindings.barcode, barcode),
          isNull(barcodeBindings.deletedAt),
        ),
      )
      .get();
    if (binding === undefined) throw new NotFoundException(`Barcode ${barcode} not found`);
    return binding;
  }

  softDelete(auth: AuthContext, id: string) {
    const row = this.drizzle.db
      .select()
      .from(barcodeBindings)
      .where(
        and(
          eq(barcodeBindings.id, id),
          eq(barcodeBindings.tenantId, auth.tenantId),
          isNull(barcodeBindings.deletedAt),
        ),
      )
      .get();
    if (row === undefined) throw new NotFoundException(`BarcodeBinding ${id} not found`);
    this.drizzle.db
      .update(barcodeBindings)
      .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(barcodeBindings.id, id))
      .run();
  }
}
