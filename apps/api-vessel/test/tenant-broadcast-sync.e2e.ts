import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq, sql } from 'drizzle-orm';
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

/**
 * H8: parametrised round-trip for all 16 tenant-scoped materialisers.
 *
 * Each spec drives one describe block with three tests: insert → row exists
 * with expected projection, update (newer HLC, one field changed) → field
 * merged + untouched fields preserved, delete → deletedAt set. FK-dependent
 * entities (ApprovalStep needs ApprovalFlow; DocumentRevision needs
 * QhseDocument) declare a `setup` callback that seeds the parent first.
 *
 * The existing detailed Jha / DrybmsElement / QhseObjective blocks above
 * stay — they cover edge cases (JSON arrays, LWW merge of multiple fields).
 * This block locks in basic correctness for every materialiser so a future
 * field-rename in tenant-materialisers.ts can't silently rot 13 of 16.
 */

interface MaterialiserSpec {
  entityType: string;
  tableName: string;
  /** Build the upsert payload. tenantId + the field-under-test live here. */
  payload: (hlc: string, tenantId: string, ctx: Record<string, string>) => LwwRecord;
  /** Field to change in the second-pass update (and the new value). */
  updateField: string;
  updateValue: unknown;
  /** Column on the projected row to read for the update assertion. */
  updateAssertColumn: string;
  /** Column to verify is preserved across the LWW merge. */
  preservedColumn: string;
  preservedValue: unknown;
  /** Optional FK setup. Returns ctx values used in `payload`. */
  setup?: (db: typeof drizzle.db, tenantId: string) => Record<string, string>;
}

const SPECS: MaterialiserSpec[] = [
  {
    entityType: 'MasterComponent',
    tableName: 'master_components',
    payload: (hlc, tenantId) => ({
      tenantId: { value: tenantId, hlc },
      name: { value: 'Main Engine SFI 210', hlc },
      description: { value: '6-cyl 2-stroke', hlc },
      sfi: { value: '210', hlc },
      category: { value: 'Propulsion', hlc },
    }),
    updateField: 'name',
    updateValue: 'Main Engine SFI 210 (rev)',
    updateAssertColumn: 'name',
    preservedColumn: 'sfi',
    preservedValue: '210',
  },
  {
    entityType: 'PartCategory',
    tableName: 'part_categories',
    payload: (hlc, tenantId) => ({
      tenantId: { value: tenantId, hlc },
      name: { value: 'Filters', hlc },
      description: { value: 'Oil, fuel, air', hlc },
    }),
    updateField: 'description',
    updateValue: 'Oil and fuel only',
    updateAssertColumn: 'description',
    preservedColumn: 'name',
    preservedValue: 'Filters',
  },
  {
    entityType: 'Supplier',
    tableName: 'suppliers',
    payload: (hlc, tenantId) => ({
      tenantId: { value: tenantId, hlc },
      name: { value: 'Acme Marine', hlc },
      contactEmail: { value: 'sales@acme.test', hlc },
      country: { value: 'NL', hlc },
      isActive: { value: true, hlc },
    }),
    updateField: 'country',
    updateValue: 'DE',
    updateAssertColumn: 'country',
    preservedColumn: 'name',
    preservedValue: 'Acme Marine',
  },
  {
    entityType: 'ApprovalFlow',
    tableName: 'approval_flows',
    payload: (hlc, tenantId) => ({
      tenantId: { value: tenantId, hlc },
      name: { value: 'PO approval — standard', hlc },
      description: { value: 'Two-step officer→master', hlc },
      isActive: { value: true, hlc },
    }),
    updateField: 'name',
    updateValue: 'PO approval — standard (v2)',
    updateAssertColumn: 'name',
    preservedColumn: 'description',
    preservedValue: 'Two-step officer→master',
  },
  {
    entityType: 'ApprovalStep',
    tableName: 'approval_steps',
    setup: (db, tenantId) => {
      const flowId = newId();
      const hlc = hlcAt(1_700_000_001_000);
      db.run(sql`INSERT INTO approval_flows (id, tenant_id, name, is_active, created_at, updated_at, hlc)
                 VALUES (${flowId}, ${tenantId}, ${'PO approval — for ApprovalStep test'}, 1,
                         ${new Date().toISOString()}, ${new Date().toISOString()}, ${hlc})`);
      return { flowId };
    },
    payload: (hlc, tenantId, ctx) => ({
      tenantId: { value: tenantId, hlc },
      flowId: { value: ctx['flowId']!, hlc },
      stepOrder: { value: 1, hlc },
      approverRole: { value: 'OFFICER', hlc },
      limitAmount: { value: '5000.00', hlc },
      limitCurrency: { value: 'USD', hlc },
    }),
    updateField: 'stepOrder',
    updateValue: 2,
    updateAssertColumn: 'step_order',
    preservedColumn: 'approver_role',
    preservedValue: 'OFFICER',
  },
  {
    entityType: 'CertificateType',
    tableName: 'certificate_types',
    payload: (hlc, tenantId) => ({
      tenantId: { value: tenantId, hlc },
      name: { value: 'STCW VI/1', hlc },
      description: { value: 'Basic safety training', hlc },
      alertDaysJson: { value: [90, 60, 30, 7], hlc },
    }),
    updateField: 'description',
    updateValue: 'Basic safety training (updated)',
    updateAssertColumn: 'description',
    preservedColumn: 'name',
    preservedValue: 'STCW VI/1',
  },
  {
    entityType: 'DrillType',
    tableName: 'drill_types',
    payload: (hlc, tenantId) => ({
      tenantId: { value: tenantId, hlc },
      name: { value: 'Fire drill', hlc },
      description: { value: 'Engine room fire', hlc },
    }),
    updateField: 'description',
    updateValue: 'Engine room + accommodation fire',
    updateAssertColumn: 'description',
    preservedColumn: 'name',
    preservedValue: 'Fire drill',
  },
  {
    entityType: 'PermitTemplate',
    tableName: 'permit_templates',
    payload: (hlc, tenantId) => ({
      tenantId: { value: tenantId, hlc },
      permitType: { value: 'HOT_WORK', hlc },
      name: { value: 'Hot work permit', hlc },
      checklistItemsJson: { value: ['Fire watch posted', 'Extinguisher ready'], hlc },
    }),
    updateField: 'name',
    updateValue: 'Hot work permit (v2)',
    updateAssertColumn: 'name',
    preservedColumn: 'permit_type',
    preservedValue: 'HOT_WORK',
  },
  {
    entityType: 'ChecklistTemplate',
    tableName: 'checklist_templates',
    payload: (hlc, tenantId) => ({
      tenantId: { value: tenantId, hlc },
      title: { value: 'Bunker checklist', hlc },
      description: { value: 'Pre-bunkering safety', hlc },
      itemsJson: { value: [{ label: 'SOPEP kit ready' }], hlc },
    }),
    updateField: 'title',
    updateValue: 'Bunker checklist (rev A)',
    updateAssertColumn: 'title',
    preservedColumn: 'description',
    preservedValue: 'Pre-bunkering safety',
  },
  {
    entityType: 'QhseDocument',
    tableName: 'qhse_documents',
    payload: (hlc, tenantId) => ({
      tenantId: { value: tenantId, hlc },
      title: { value: 'SMS Manual', hlc },
      category: { value: 'Manual', hlc },
      description: { value: 'Safety management system', hlc },
      isControlled: { value: true, hlc },
    }),
    updateField: 'title',
    updateValue: 'SMS Manual (rev 2)',
    updateAssertColumn: 'title',
    preservedColumn: 'category',
    preservedValue: 'Manual',
  },
  {
    entityType: 'DocumentRevision',
    tableName: 'document_revisions',
    setup: (db, tenantId) => {
      const docId = newId();
      const hlc = hlcAt(1_700_000_002_000);
      db.run(sql`INSERT INTO qhse_documents (id, tenant_id, title, is_controlled, created_at, updated_at, hlc)
                 VALUES (${docId}, ${tenantId}, ${'Parent doc for revision test'}, 0,
                         ${new Date().toISOString()}, ${new Date().toISOString()}, ${hlc})`);
      return { docId };
    },
    payload: (hlc, tenantId, ctx) => ({
      tenantId: { value: tenantId, hlc },
      documentId: { value: ctx['docId']!, hlc },
      revisionNumber: { value: 1, hlc },
      summary: { value: 'Initial', hlc },
      s3Key: { value: 'docs/test/rev-1.pdf', hlc },
    }),
    updateField: 'summary',
    updateValue: 'Initial (annotated)',
    updateAssertColumn: 'summary',
    preservedColumn: 's3_key',
    preservedValue: 'docs/test/rev-1.pdf',
  },
  {
    entityType: 'FuelProduct',
    tableName: 'fuel_products',
    payload: (hlc, tenantId) => ({
      tenantId: { value: tenantId, hlc },
      name: { value: 'VLSFO 0.5%', hlc },
      tankType: { value: 'HFO', hlc },
      sulphurPct: { value: '0.50', hlc },
      densityKgM3: { value: '991.0', hlc },
    }),
    // Avoid numeric-affinity columns (sulphurPct, densityKgM3) for the
    // assertion path — SQLite would coerce the TEXT-stored decimal back
    // to a number on raw select, which makes the round-trip type-fragile.
    // Stick to TEXT columns where the column-affinity round-trip is
    // identity.
    updateField: 'name',
    updateValue: 'VLSFO 0.5% (rev)',
    updateAssertColumn: 'name',
    preservedColumn: 'tank_type',
    preservedValue: 'HFO',
  },
  {
    entityType: 'Jha',
    tableName: 'jhas',
    payload: (hlc, tenantId) => ({
      tenantId: { value: tenantId, hlc },
      ref: { value: 'JHA-PARAM', hlc },
      title: { value: 'Parametrised', hlc },
      activity: { value: 'Test', hlc },
      hazards: { value: ['fall'], hlc },
      controls: { value: ['harness'], hlc },
      residualL: { value: 1, hlc },
      residualS: { value: 1, hlc },
    }),
    updateField: 'title',
    updateValue: 'Parametrised (rev)',
    updateAssertColumn: 'title',
    preservedColumn: 'ref',
    preservedValue: 'JHA-PARAM',
  },
  {
    entityType: 'QhseObjective',
    tableName: 'qhse_objectives',
    payload: (hlc, tenantId) => ({
      tenantId: { value: tenantId, hlc },
      category: { value: 'Q', hlc },
      label: { value: 'Audit closure %', hlc },
      target: { value: '95', hlc },
      actual: { value: '92', hlc },
      unit: { value: '%', hlc },
      status: { value: 'AMBER', hlc },
    }),
    updateField: 'actual',
    updateValue: '94',
    updateAssertColumn: 'actual',
    preservedColumn: 'label',
    preservedValue: 'Audit closure %',
  },
  {
    entityType: 'DrybmsElement',
    tableName: 'drybms_elements',
    payload: (hlc, tenantId) => ({
      tenantId: { value: tenantId, hlc },
      chapter: { value: '2', hlc },
      chapterTitle: { value: 'Risk Management', hlc },
      name: { value: 'Hazard identification', hlc },
      score: { value: 2, hlc },
      stage: { value: 'Reactive', hlc },
    }),
    updateField: 'score',
    updateValue: 4,
    updateAssertColumn: 'score',
    preservedColumn: 'chapter',
    preservedValue: '2',
  },
  {
    entityType: 'ManagementReview',
    tableName: 'management_reviews',
    payload: (hlc, tenantId) => ({
      tenantId: { value: tenantId, hlc },
      kind: { value: 'Annual', hlc },
      scheduledAt: { value: '2026-12-01T09:00:00Z', hlc },
      chair: { value: 'CEO', hlc },
      attendees: { value: 6, hlc },
      status: { value: 'SCHEDULED', hlc },
      actionsTotal: { value: 0, hlc },
      actionsDone: { value: 0, hlc },
    }),
    updateField: 'attendees',
    updateValue: 8,
    updateAssertColumn: 'attendees',
    preservedColumn: 'chair',
    preservedValue: 'CEO',
  },
];

describe.each(SPECS)('tenant-broadcast round-trip — $entityType (H8)', (spec) => {
  const id = newId();
  let baseHlcMs = 0;
  let ctx: Record<string, string> = {};

  // Each spec runs in its own beforeAll so the FK setup (when present)
  // is scoped to this describe block — keeps the test isolated from the
  // siblings even if they happen to share an entity type.
  beforeAll(() => {
    baseHlcMs = 1_700_000_500_000 + SPECS.findIndex((s) => s === spec) * 1_000;
    ctx = spec.setup ? spec.setup(drizzle.db, fixedTenantId) : {};
  });

  const readRow = () =>
    drizzle.db.get<Record<string, unknown>>(
      sql.raw(`SELECT * FROM ${spec.tableName} WHERE id = '${id}'`),
    );

  it('insert delta materialises into the entity table', async () => {
    const adapter = new DrizzleSyncAdapter(drizzle.db);
    const hlc = hlcAt(baseHlcMs);
    await adapter.applyRemoteDelta({
      entityType: spec.entityType,
      entityId: id,
      operation: 'upsert',
      payload: spec.payload(hlc, fixedTenantId, ctx),
      hlc,
      nodeId: 'shore-test',
    });
    const row = readRow();
    expect(row).toBeDefined();
    expect(row!['tenant_id']).toBe(fixedTenantId);
    expect(row!['deleted_at']).toBeNull();
  });

  it('update delta (newer HLC) merges the changed field while preserving untouched ones', async () => {
    const adapter = new DrizzleSyncAdapter(drizzle.db);
    const newerHlc = hlcAt(baseHlcMs + 1);
    await adapter.applyRemoteDelta({
      entityType: spec.entityType,
      entityId: id,
      operation: 'upsert',
      payload: { [spec.updateField]: { value: spec.updateValue, hlc: newerHlc } },
      hlc: newerHlc,
      nodeId: 'shore-test',
    });
    const row = readRow();
    expect(row).toBeDefined();
    // The materialiser re-projects all fields from the LWW-merged sync_record,
    // so unchanged columns keep their original values and the targeted field
    // takes the new one.
    expect(row![spec.updateAssertColumn]).toEqual(spec.updateValue);
    expect(row![spec.preservedColumn]).toEqual(spec.preservedValue);
  });

  it('delete delta soft-deletes (deleted_at set)', async () => {
    const adapter = new DrizzleSyncAdapter(drizzle.db);
    const deleteHlc = hlcAt(baseHlcMs + 2);
    await adapter.applyRemoteDelta({
      entityType: spec.entityType,
      entityId: id,
      operation: 'delete',
      payload: null,
      hlc: deleteHlc,
      nodeId: 'shore-test',
    });
    const row = readRow();
    expect(row).toBeDefined();
    expect(row!['deleted_at']).not.toBeNull();
  });
});
