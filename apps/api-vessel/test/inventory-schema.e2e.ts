import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulidx';
import { eq, and, sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { DrizzleService } from '../src/db/drizzle.service';
import {
  barcodeBindings,
  partCategories,
  parts,
  stockLevels,
  stockLocations,
  stockMovements,
  tenants,
  vessels,
} from '../src/db/schema';

let app: INestApplication;
let drizzle: DrizzleService;

const tenantId = ulid();
const vesselId = ulid();

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  drizzle = moduleRef.get(DrizzleService);

  drizzle.db.insert(tenants).values({ id: tenantId, name: 'inventory-vessel-test' }).run();
  drizzle.db.insert(vessels).values({ id: vesselId, tenantId, name: 'MV Drizzle Inv' }).run();
});

afterAll(async () => {
  await app.close();
});

describe('P1-5 inventory schema — SQLite', () => {
  it('round-trips a hierarchical PartCategory', () => {
    const parentCatId = ulid();
    const childCatId = ulid();

    drizzle.db
      .insert(partCategories)
      .values({ id: parentCatId, tenantId, name: 'Mechanical' })
      .run();
    drizzle.db
      .insert(partCategories)
      .values({ id: childCatId, tenantId, parentId: parentCatId, name: 'Filters' })
      .run();

    const child = drizzle.db
      .select()
      .from(partCategories)
      .where(eq(partCategories.id, childCatId))
      .all();
    expect(child[0]?.parentId).toBe(parentCatId);
    expect(child[0]?.name).toBe('Filters');

    const siblings = drizzle.db
      .select()
      .from(partCategories)
      .where(eq(partCategories.parentId, parentCatId))
      .all();
    expect(siblings).toHaveLength(1);
  });

  it('round-trips Part with partNumber and default unit', () => {
    const catId = ulid();
    const partId = ulid();

    drizzle.db.insert(partCategories).values({ id: catId, tenantId, name: 'Consumables' }).run();
    drizzle.db
      .insert(parts)
      .values({
        id: partId,
        tenantId,
        categoryId: catId,
        name: 'Oil Filter',
        partNumber: 'OIL-FLTR-001',
      })
      .run();

    const stored = drizzle.db.select().from(parts).where(eq(parts.id, partId)).all();
    expect(stored[0]?.partNumber).toBe('OIL-FLTR-001');
    expect(stored[0]?.unit).toBe('pcs'); // default
    expect(stored[0]?.categoryId).toBe(catId);
  });

  it('round-trips StockLocation and StockLevel with min/max/reorder', () => {
    const partId = ulid();
    const locationId = ulid();
    const levelId = ulid();

    drizzle.db.insert(parts).values({ id: partId, tenantId, name: 'Gasket' }).run();
    drizzle.db
      .insert(stockLocations)
      .values({ id: locationId, tenantId, vesselId, name: 'Engine Room Store' })
      .run();
    drizzle.db
      .insert(stockLevels)
      .values({
        id: levelId,
        tenantId,
        vesselId,
        partId,
        locationId,
        minStock: '2',
        maxStock: '20',
        reorderPoint: '5',
      })
      .run();

    const stored = drizzle.db.select().from(stockLevels).where(eq(stockLevels.id, levelId)).all();
    expect(stored[0]?.minStock).toBe('2');
    expect(stored[0]?.maxStock).toBe('20');
    expect(stored[0]?.reorderPoint).toBe('5');
  });

  it('rejects duplicate StockLevel for same (tenant, vessel, part, location)', () => {
    const partId = ulid();
    const locationId = ulid();

    drizzle.db.insert(parts).values({ id: partId, tenantId, name: 'Bolt M10' }).run();
    drizzle.db
      .insert(stockLocations)
      .values({ id: locationId, tenantId, vesselId, name: 'Deck Store' })
      .run();
    drizzle.db
      .insert(stockLevels)
      .values({ id: ulid(), tenantId, vesselId, partId, locationId })
      .run();

    expect(() =>
      drizzle.db
        .insert(stockLevels)
        .values({ id: ulid(), tenantId, vesselId, partId, locationId })
        .run(),
    ).toThrow(/unique|UNIQUE constraint/i);
  });

  it('computes ROB by replaying StockMovements (signed quantity SUM)', () => {
    const partId = ulid();
    const locationId = ulid();

    drizzle.db.insert(parts).values({ id: partId, tenantId, name: 'Lube Oil (ROB test)' }).run();
    drizzle.db
      .insert(stockLocations)
      .values({ id: locationId, tenantId, vesselId, name: 'Lube Store' })
      .run();

    const movements = [
      { quantity: '100', movementType: 'RECEIPT' as const },
      { quantity: '-15', movementType: 'CONSUMPTION' as const },
      { quantity: '-5', movementType: 'CONSUMPTION' as const },
      { quantity: '3', movementType: 'ADJUSTMENT' as const },
    ];
    for (const m of movements) {
      drizzle.db
        .insert(stockMovements)
        .values({
          id: ulid(),
          tenantId,
          vesselId,
          partId,
          locationId,
          movementType: m.movementType,
          quantity: m.quantity,
          recordedAt: new Date().toISOString(),
        })
        .run();
    }

    const [row] = drizzle.db
      .select({ rob: sql<string>`SUM(CAST(${stockMovements.quantity} AS REAL))` })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.tenantId, tenantId),
          eq(stockMovements.vesselId, vesselId),
          eq(stockMovements.partId, partId),
          eq(stockMovements.locationId, locationId),
        ),
      )
      .all();
    expect(parseFloat(row?.rob ?? '0')).toBeCloseTo(83, 4);
  });

  it('rejects duplicate barcode within a tenant', () => {
    const partId = ulid();
    drizzle.db.insert(parts).values({ id: partId, tenantId, name: 'Valve' }).run();

    drizzle.db
      .insert(barcodeBindings)
      .values({ id: ulid(), tenantId, partId, barcode: 'BC-12345' })
      .run();
    expect(() =>
      drizzle.db
        .insert(barcodeBindings)
        .values({ id: ulid(), tenantId, partId, barcode: 'BC-12345' })
        .run(),
    ).toThrow(/unique|UNIQUE constraint/i);
  });
});
