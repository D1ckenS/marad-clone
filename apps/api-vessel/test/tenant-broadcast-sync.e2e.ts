import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import type { LwwRecord, SyncDelta } from '@fleetops/sync-engine';
import { encodeHlc, newId } from '@fleetops/domain';
import { AppModule } from '../src/app.module';
import { DrizzleService } from '../src/db/drizzle.service';
import { drybmsElements, jhas, qhseObjectives, tenants } from '../src/db/schema';
import { DrizzleSyncAdapter } from '../src/sync/drizzle-sync-adapter';
import { materialiseTenantEntity, tenantMaterialisers } from '../src/sync/tenant-materialisers';

// Helper to mint a valid HLC string in the wire format
// `<12-hex-ms>-<4-hex-counter>-<nodeId>` (see packages/domain/src/clock.ts).
// Counter increments per call so strictly-greater comparisons hold.
let hlcCounter = 0;
function hlcAt(physicalMs: number): string {
  return encodeHlc({ physicalMs, counter: hlcCounter++, nodeId: 'shore-test' });
}

/**
 * Vessel-side tests for the shore→vessel tenant-broadcast pathway.
 *
 * The wire-level transfer (gRPC) is already exercised by the existing
 * sync tests. These tests cover the new pieces:
 *
 *   1. The materialiser registry is wired for all 16 tenant-scoped
 *      entities (so a bare-bones smoke test catches typos in the keys).
 *   2. A synthetic remote delta hits the materialiser via
 *      DrizzleSyncAdapter.applyRemoteDelta and produces the expected
 *      row in the real entity table.
 *   3. Delete deltas soft-delete the row.
 *   4. Updates merge per-field LWW and re-project to the entity table.
 */

let app: INestApplication;
let drizzle: DrizzleService;
const fixedTenantId = newId();

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  drizzle = app.get(DrizzleService);

  // FK from every tenant-scoped table → tenants(id) means we need a real
  // tenant row in the vessel DB before materialisation can succeed.
  drizzle.db.insert(tenants).values({ id: fixedTenantId, name: 'broadcast-sync-test' }).run();
});

afterAll(async () => {
  await app.close();
});

describe('tenant-broadcast — materialiser registry', () => {
  it('has handlers for all 16 tenant-scoped entities', () => {
    const expected = [
      'MasterComponent',
      'PartCategory',
      'Supplier',
      'ApprovalFlow',
      'ApprovalStep',
      'CertificateType',
      'DrillType',
      'PermitTemplate',
      'ChecklistTemplate',
      'QhseDocument',
      'DocumentRevision',
      'FuelProduct',
      'Jha',
      'QhseObjective',
      'DrybmsElement',
      'ManagementReview',
    ];
    for (const t of expected) {
      expect(
        tenantMaterialisers[t],
        `materialiser missing for ${t} — add a register('${t}', …) entry in tenant-materialisers.ts`,
      ).toBeDefined();
    }
  });

  it('returns false (no-op) for unregistered entityType', () => {
    const ran = materialiseTenantEntity(
      drizzle.db,
      'SomeVesselScopedEntity',
      newId(),
      {},
      hlcAt(1_700_000_000_000),
      null,
    );
    expect(ran).toBe(false);
  });
});

describe('tenant-broadcast — Jha materialiser end-to-end', () => {
  const tenantId = fixedTenantId;
  const jhaId = newId();
  const hlc = hlcAt(1_700_000_000_000);

  it('materialises a Jha upsert delta into the jhas table', async () => {
    const adapter = new DrizzleSyncAdapter(drizzle.db);
    const fieldsForDelta: LwwRecord = {
      tenantId: { value: tenantId, hlc },
      ref: { value: 'JHA-001', hlc },
      title: { value: 'Working aloft', hlc },
      activity: { value: 'Hot work + scaffolding', hlc },
      hazards: { value: ['fall', 'dropped object'], hlc },
      controls: { value: ['harness', 'exclusion zone'], hlc },
      residualL: { value: 2, hlc },
      residualS: { value: 3, hlc },
      reviewedAt: { value: null, hlc },
      reviewedBy: { value: null, hlc },
    };
    const delta: SyncDelta = {
      entityType: 'Jha',
      entityId: jhaId,
      operation: 'upsert',
      payload: fieldsForDelta,
      hlc,
      nodeId: 'shore-test',
    };
    await adapter.applyRemoteDelta(delta);

    const row = drizzle.db.select().from(jhas).where(eq(jhas.id, jhaId)).get();
    expect(row).toBeDefined();
    expect(row!.tenantId).toBe(tenantId);
    expect(row!.ref).toBe('JHA-001');
    expect(row!.title).toBe('Working aloft');
    expect(row!.activity).toBe('Hot work + scaffolding');
    expect(JSON.parse(row!.hazards)).toEqual(['fall', 'dropped object']);
    expect(JSON.parse(row!.controls)).toEqual(['harness', 'exclusion zone']);
    expect(row!.residualL).toBe(2);
    expect(row!.residualS).toBe(3);
    expect(row!.hlc).toBe(hlc);
    expect(row!.deletedAt).toBeNull();
  });

  it('LWW-merges an update delta with a fresher HLC and re-projects to jhas', async () => {
    const adapter = new DrizzleSyncAdapter(drizzle.db);
    const newerHlc = hlcAt(1_700_000_000_001); // strictly greater (later physicalMs)
    const updateFields: LwwRecord = {
      title: { value: 'Working aloft (revised)', hlc: newerHlc },
      residualL: { value: 1, hlc: newerHlc },
    };
    await adapter.applyRemoteDelta({
      entityType: 'Jha',
      entityId: jhaId,
      operation: 'upsert',
      payload: updateFields,
      hlc: newerHlc,
      nodeId: 'shore-test',
    });

    const row = drizzle.db.select().from(jhas).where(eq(jhas.id, jhaId)).get();
    expect(row).toBeDefined();
    expect(row!.title).toBe('Working aloft (revised)');
    expect(row!.residualL).toBe(1);
    // Untouched fields survive the LWW merge
    expect(row!.ref).toBe('JHA-001');
    expect(row!.residualS).toBe(3);
    expect(JSON.parse(row!.hazards)).toEqual(['fall', 'dropped object']);
  });

  it('delete delta soft-deletes the row (deletedAt set)', async () => {
    const adapter = new DrizzleSyncAdapter(drizzle.db);
    const deleteHlc = hlcAt(1_700_000_000_002);
    await adapter.applyRemoteDelta({
      entityType: 'Jha',
      entityId: jhaId,
      operation: 'delete',
      payload: null,
      hlc: deleteHlc,
      nodeId: 'shore-test',
    });

    const row = drizzle.db.select().from(jhas).where(eq(jhas.id, jhaId)).get();
    expect(row).toBeDefined();
    expect(row!.deletedAt).not.toBeNull();
  });
});

describe('tenant-broadcast — DrybmsElement materialiser', () => {
  it('handles a simple tenant-scoped entity round-trip', async () => {
    const adapter = new DrizzleSyncAdapter(drizzle.db);
    const tenantId = fixedTenantId;
    const elementId = newId();
    const hlc = hlcAt(1_700_000_000_100);
    await adapter.applyRemoteDelta({
      entityType: 'DrybmsElement',
      entityId: elementId,
      operation: 'upsert',
      payload: {
        tenantId: { value: tenantId, hlc },
        chapter: { value: '1', hlc },
        chapterTitle: { value: 'Leadership', hlc },
        name: { value: 'Senior management commitment', hlc },
        score: { value: 3, hlc },
        stage: { value: 'Proactive', hlc },
        evidence: { value: 'Annual review minutes', hlc },
      },
      hlc,
      nodeId: 'shore-test',
    });
    const row = drizzle.db
      .select()
      .from(drybmsElements)
      .where(eq(drybmsElements.id, elementId))
      .get();
    expect(row).toBeDefined();
    expect(row!.chapter).toBe('1');
    expect(row!.score).toBe(3);
    expect(row!.stage).toBe('Proactive');
  });
});

describe('tenant-broadcast — QhseObjective materialiser handles JSON trend', () => {
  it('stringifies the trend array and parses cleanly', async () => {
    const adapter = new DrizzleSyncAdapter(drizzle.db);
    const tenantId = fixedTenantId;
    const objId = newId();
    const hlc = hlcAt(1_700_000_000_200);
    await adapter.applyRemoteDelta({
      entityType: 'QhseObjective',
      entityId: objId,
      operation: 'upsert',
      payload: {
        tenantId: { value: tenantId, hlc },
        category: { value: 'S', hlc },
        label: { value: 'LTI rate', hlc },
        target: { value: '0', hlc },
        actual: { value: '0', hlc },
        unit: { value: 'per 1M hours', hlc },
        status: { value: 'GREEN', hlc },
        trend: { value: [0, 0, 1, 0, 0], hlc },
        delta: { value: null, hlc },
        periodFrom: { value: null, hlc },
        periodTo: { value: null, hlc },
      },
      hlc,
      nodeId: 'shore-test',
    });
    const row = drizzle.db.select().from(qhseObjectives).where(eq(qhseObjectives.id, objId)).get();
    expect(row).toBeDefined();
    expect(row!.category).toBe('S');
    expect(row!.label).toBe('LTI rate');
    expect(JSON.parse(row!.trend!)).toEqual([0, 0, 1, 0, 0]);
  });
});
