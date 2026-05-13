import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulidx';
import { Prisma } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

let app: INestApplication;
let prisma: PrismaService;

const tenantId = ulid();
const vesselId = ulid();

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  prisma = moduleRef.get(PrismaService);

  await prisma.tenant.create({ data: { id: tenantId, name: 'inventory-schema-test' } });
  await prisma.vessel.create({ data: { id: vesselId, tenantId, name: 'MV Inventory' } });
});

afterAll(async () => {
  await prisma.barcodeBinding.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.stockMovement.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.stockLevel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.stockLocation.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.part.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.partCategory.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

describe('P1-5 inventory schema — Postgres', () => {
  it('round-trips a hierarchical PartCategory', async () => {
    const parentCatId = ulid();
    const childCatId = ulid();

    await prisma.partCategory.create({
      data: { id: parentCatId, tenantId, name: 'Mechanical' },
    });
    await prisma.partCategory.create({
      data: { id: childCatId, tenantId, parentId: parentCatId, name: 'Filters' },
    });

    const child = await prisma.partCategory.findUnique({
      where: { id: childCatId },
      include: { parent: true },
    });
    expect(child?.parent?.id).toBe(parentCatId);
    expect(child?.parent?.name).toBe('Mechanical');

    const parent = await prisma.partCategory.findUnique({
      where: { id: parentCatId },
      include: { children: true },
    });
    expect(parent?.children).toHaveLength(1);
    expect(parent?.children[0]?.name).toBe('Filters');
  });

  it('round-trips a Part with partNumber and unit', async () => {
    const catId = ulid();
    const partId = ulid();

    await prisma.partCategory.create({ data: { id: catId, tenantId, name: 'Cat-A' } });
    await prisma.part.create({
      data: {
        id: partId,
        tenantId,
        categoryId: catId,
        name: 'Oil Filter',
        partNumber: 'OIL-FLTR-001',
        unit: 'pcs',
      },
    });

    const stored = await prisma.part.findUnique({
      where: { id: partId },
      include: { category: true },
    });
    expect(stored?.partNumber).toBe('OIL-FLTR-001');
    expect(stored?.unit).toBe('pcs');
    expect(stored?.category?.name).toBe('Cat-A');
  });

  it('round-trips StockLocation and StockLevel with min/max/reorder', async () => {
    const partId = ulid();
    const locationId = ulid();
    const levelId = ulid();

    await prisma.part.create({ data: { id: partId, tenantId, name: 'Gasket' } });
    await prisma.stockLocation.create({
      data: { id: locationId, tenantId, vesselId, name: 'Engine Room Store' },
    });
    await prisma.stockLevel.create({
      data: {
        id: levelId,
        tenantId,
        vesselId,
        partId,
        locationId,
        minStock: new Prisma.Decimal('2'),
        maxStock: new Prisma.Decimal('20'),
        reorderPoint: new Prisma.Decimal('5'),
      },
    });

    const stored = await prisma.stockLevel.findUnique({
      where: { id: levelId },
      include: { part: true, location: true },
    });
    expect(stored?.minStock.toString()).toBe('2');
    expect(stored?.maxStock?.toString()).toBe('20');
    expect(stored?.reorderPoint?.toString()).toBe('5');
    expect(stored?.location?.name).toBe('Engine Room Store');
    expect(stored?.part?.name).toBe('Gasket');
  });

  it('rejects duplicate StockLevel for same (tenant, vessel, part, location)', async () => {
    const partId = ulid();
    const locationId = ulid();

    await prisma.part.create({ data: { id: partId, tenantId, name: 'Bolt M10' } });
    await prisma.stockLocation.create({
      data: { id: locationId, tenantId, vesselId, name: 'Deck Store' },
    });
    await prisma.stockLevel.create({
      data: { id: ulid(), tenantId, vesselId, partId, locationId },
    });

    await expect(
      prisma.stockLevel.create({
        data: { id: ulid(), tenantId, vesselId, partId, locationId },
      }),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it('computes ROB by replaying StockMovements (signed quantity SUM)', async () => {
    const partId = ulid();
    const locationId = ulid();

    await prisma.part.create({ data: { id: partId, tenantId, name: 'Lube Oil (ROB test)' } });
    await prisma.stockLocation.create({
      data: { id: locationId, tenantId, vesselId, name: 'Lube Store' },
    });

    const movementsData = [
      { quantity: '100', movementType: 'RECEIPT' as const },
      { quantity: '-15', movementType: 'CONSUMPTION' as const },
      { quantity: '-5', movementType: 'CONSUMPTION' as const },
      { quantity: '3', movementType: 'ADJUSTMENT' as const },
    ];
    for (const m of movementsData) {
      await prisma.stockMovement.create({
        data: {
          id: ulid(),
          tenantId,
          vesselId,
          partId,
          locationId,
          movementType: m.movementType,
          quantity: new Prisma.Decimal(m.quantity),
          recordedAt: new Date(),
        },
      });
    }

    const result = await prisma.$queryRaw<{ rob: string }[]>`
      SELECT SUM(quantity)::text AS rob
      FROM stock_movements
      WHERE tenant_id = ${tenantId}
        AND vessel_id = ${vesselId}
        AND part_id = ${partId}
        AND location_id = ${locationId}
        AND deleted_at IS NULL
    `;
    expect(parseFloat(result[0]?.rob ?? '0')).toBeCloseTo(83, 4);
  });

  it('rejects duplicate barcode within a tenant', async () => {
    const partId = ulid();
    await prisma.part.create({ data: { id: partId, tenantId, name: 'Valve' } });

    await prisma.barcodeBinding.create({
      data: { id: ulid(), tenantId, partId, barcode: 'BC-12345' },
    });
    await expect(
      prisma.barcodeBinding.create({
        data: { id: ulid(), tenantId, partId, barcode: 'BC-12345' },
      }),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it('declares RLS tenant_isolation policies on all inventory tables', async () => {
    const tables = [
      'part_categories',
      'parts',
      'stock_locations',
      'stock_levels',
      'stock_movements',
      'barcode_bindings',
    ];
    const rows = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_policies
      WHERE schemaname = 'public' AND policyname LIKE '%_tenant_isolation'
    `;
    const found = new Set(rows.map((r) => r.tablename));
    for (const t of tables) {
      expect(found.has(t), `pg_policies missing tenant_isolation on ${t}`).toBe(true);
    }
  });
});
