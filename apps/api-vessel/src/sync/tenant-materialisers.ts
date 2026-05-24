import type { LwwRecord } from '@fleetops/sync-engine';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
  approvalFlows,
  approvalSteps,
  certificateTypes,
  checklistTemplates,
  documentRevisions,
  drillTypes,
  drybmsElements,
  fuelProducts,
  jhas,
  managementReviews,
  masterComponents,
  partCategories,
  permitTemplates,
  qhseDocuments,
  qhseObjectives,
  suppliers,
} from '../db/schema';

/**
 * Materialiser registry — vessel-side projection from sync_records into
 * the real entity table, for tenant-scoped catalogs that shore broadcasts
 * via TenantBroadcastRecorder.
 *
 * Each materialiser receives the post-LWW-merge `fields` (a LwwRecord
 * with per-field { value, hlc }) and writes the row to its drizzle table.
 * On delete the materialiser does a soft-delete (sets deleted_at).
 *
 * The materialiser is called from DrizzleSyncAdapter.applyRemoteDelta
 * AFTER the sync_records merge, so the values it sees reflect the
 * authoritative per-field state — not just the latest delta payload.
 *
 * Conventions:
 *   - `id` comes from delta.entityId (NOT from fields[id])
 *   - JSON columns (text-storing-JSON in SQLite) are re-stringified
 *   - Boolean fields use drizzle's `mode: 'boolean'` so we pass JS
 *     booleans; drizzle does the 0/1 conversion
 *   - Missing optional fields collapse to NULL via `f(fields, k)`
 *
 * Adding a new entity:
 *   1. Add an entry below using the per-table drizzle insert/upsert.
 *   2. Add a shore-side service hook that calls
 *      `tenantBroadcast.broadcastUpsert(tx, tenantId, 'EntityName', id, row)`.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- drizzle generic is verbose; runtime SQL doesn't care
type Db = BetterSQLite3Database<any>;

const json = (fields: LwwRecord, key: string): string | null => {
  const v = fields[key]?.value;
  if (v === undefined || v === null) return null;
  return typeof v === 'string' ? v : JSON.stringify(v);
};

const bool = (fields: LwwRecord, key: string, defaultValue = false): boolean => {
  const v = fields[key]?.value;
  if (v === undefined || v === null) return defaultValue;
  return Boolean(v);
};

const num = (fields: LwwRecord, key: string, defaultValue = 0): number => {
  const v = fields[key]?.value;
  if (v === undefined || v === null) return defaultValue;
  return typeof v === 'number' ? v : Number(v);
};

const str = (fields: LwwRecord, key: string, defaultValue = ''): string => {
  const v = fields[key]?.value;
  if (v === undefined || v === null) return defaultValue;
  return String(v);
};

const optStr = (fields: LwwRecord, key: string): string | null => {
  const v = fields[key]?.value;
  if (v === undefined || v === null) return null;
  return String(v);
};

type MaterialiserFn = (
  db: Db,
  entityId: string,
  fields: LwwRecord,
  hlc: string,
  deletedAt: string | null,
) => void;

/**
 * Soft-delete helper — the `update().set().where()` call is essentially
 * the same shape for every materialiser, but each one needs its own
 * typed table reference. We inline the per-table call in each register()
 * delete branch below rather than fighting drizzle's generics here.
 */

/**
 * Registry of materialisers keyed by entityType (the same string the
 * broadcast recorder uses on shore). Entries are added below.
 */
export const tenantMaterialisers: Record<string, MaterialiserFn> = {};

function register(entityType: string, fn: MaterialiserFn): void {
  tenantMaterialisers[entityType] = fn;
}

// ── MasterComponent ──────────────────────────────────────────────────────────

register('MasterComponent', (db, id, fields, hlc, deletedAt) => {
  if (deletedAt !== null) {
    db.update(masterComponents)
      .set({ deletedAt, updatedAt: new Date().toISOString() })
      .where(eq(masterComponents.id, id))
      .run();
    return;
  }
  const now = new Date().toISOString();
  const row = {
    id,
    tenantId: str(fields, 'tenantId'),
    name: str(fields, 'name'),
    description: optStr(fields, 'description'),
    sfi: optStr(fields, 'sfi'),
    category: optStr(fields, 'category'),
    createdAt: now,
    updatedAt: now,
    hlc,
    deletedAt: null,
  };
  db.insert(masterComponents)
    .values(row)
    .onConflictDoUpdate({
      target: masterComponents.id,
      set: {
        name: row.name,
        description: row.description,
        sfi: row.sfi,
        category: row.category,
        updatedAt: now,
        hlc,
        deletedAt: null,
      },
    })
    .run();
});

// ── PartCategory ─────────────────────────────────────────────────────────────

register('PartCategory', (db, id, fields, hlc, deletedAt) => {
  if (deletedAt !== null) {
    db.update(partCategories).set({ deletedAt }).where(eq(partCategories.id, id)).run();
    return;
  }
  const now = new Date().toISOString();
  const row = {
    id,
    tenantId: str(fields, 'tenantId'),
    parentId: optStr(fields, 'parentId'),
    name: str(fields, 'name'),
    description: optStr(fields, 'description'),
    createdAt: now,
    updatedAt: now,
    hlc,
    deletedAt: null,
  };
  db.insert(partCategories)
    .values(row)
    .onConflictDoUpdate({
      target: partCategories.id,
      set: {
        parentId: row.parentId,
        name: row.name,
        description: row.description,
        updatedAt: now,
        hlc,
        deletedAt: null,
      },
    })
    .run();
});

// ── Supplier ─────────────────────────────────────────────────────────────────

register('Supplier', (db, id, fields, hlc, deletedAt) => {
  if (deletedAt !== null) {
    db.update(suppliers).set({ deletedAt }).where(eq(suppliers.id, id)).run();
    return;
  }
  const now = new Date().toISOString();
  const row = {
    id,
    tenantId: str(fields, 'tenantId'),
    name: str(fields, 'name'),
    contactName: optStr(fields, 'contactName'),
    contactEmail: optStr(fields, 'contactEmail'),
    contactPhone: optStr(fields, 'contactPhone'),
    address: optStr(fields, 'address'),
    country: optStr(fields, 'country'),
    notes: optStr(fields, 'notes'),
    isActive: bool(fields, 'isActive', true),
    createdAt: now,
    updatedAt: now,
    hlc,
    deletedAt: null,
  };
  db.insert(suppliers)
    .values(row)
    .onConflictDoUpdate({
      target: suppliers.id,
      set: {
        name: row.name,
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        contactPhone: row.contactPhone,
        address: row.address,
        country: row.country,
        notes: row.notes,
        isActive: row.isActive,
        updatedAt: now,
        hlc,
        deletedAt: null,
      },
    })
    .run();
});

// ── ApprovalFlow ─────────────────────────────────────────────────────────────

register('ApprovalFlow', (db, id, fields, hlc, deletedAt) => {
  if (deletedAt !== null) {
    db.update(approvalFlows).set({ deletedAt }).where(eq(approvalFlows.id, id)).run();
    return;
  }
  const now = new Date().toISOString();
  const row = {
    id,
    tenantId: str(fields, 'tenantId'),
    name: str(fields, 'name'),
    description: optStr(fields, 'description'),
    isActive: bool(fields, 'isActive', true),
    createdAt: now,
    updatedAt: now,
    hlc,
    deletedAt: null,
  };
  db.insert(approvalFlows)
    .values(row)
    .onConflictDoUpdate({
      target: approvalFlows.id,
      set: {
        name: row.name,
        description: row.description,
        isActive: row.isActive,
        updatedAt: now,
        hlc,
        deletedAt: null,
      },
    })
    .run();
});

// ── ApprovalStep ─────────────────────────────────────────────────────────────

register('ApprovalStep', (db, id, fields, hlc, deletedAt) => {
  if (deletedAt !== null) {
    db.update(approvalSteps).set({ deletedAt }).where(eq(approvalSteps.id, id)).run();
    return;
  }
  const now = new Date().toISOString();
  const row = {
    id,
    tenantId: str(fields, 'tenantId'),
    flowId: str(fields, 'flowId'),
    stepOrder: num(fields, 'stepOrder', 1),
    approverRole: str(fields, 'approverRole') as never,
    limitAmount: optStr(fields, 'limitAmount'),
    limitCurrency: str(fields, 'limitCurrency', 'USD'),
    createdAt: now,
    updatedAt: now,
    hlc,
    deletedAt: null,
  };
  db.insert(approvalSteps)
    .values(row)
    .onConflictDoUpdate({
      target: approvalSteps.id,
      set: {
        flowId: row.flowId,
        stepOrder: row.stepOrder,
        approverRole: row.approverRole,
        limitAmount: row.limitAmount,
        limitCurrency: row.limitCurrency,
        updatedAt: now,
        hlc,
        deletedAt: null,
      },
    })
    .run();
});

// ── CertificateType ──────────────────────────────────────────────────────────

register('CertificateType', (db, id, fields, _hlc, deletedAt) => {
  if (deletedAt !== null) {
    db.update(certificateTypes).set({ deletedAt }).where(eq(certificateTypes.id, id)).run();
    return;
  }
  const now = new Date().toISOString();
  const row = {
    id,
    tenantId: str(fields, 'tenantId'),
    name: str(fields, 'name'),
    description: optStr(fields, 'description'),
    alertDaysJson: json(fields, 'alertDaysJson'),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  db.insert(certificateTypes)
    .values(row)
    .onConflictDoUpdate({
      target: certificateTypes.id,
      set: {
        name: row.name,
        description: row.description,
        alertDaysJson: row.alertDaysJson,
        updatedAt: now,
        deletedAt: null,
      },
    })
    .run();
});

// ── DrillType ────────────────────────────────────────────────────────────────

register('DrillType', (db, id, fields, _hlc, deletedAt) => {
  if (deletedAt !== null) {
    db.update(drillTypes).set({ deletedAt }).where(eq(drillTypes.id, id)).run();
    return;
  }
  const now = new Date().toISOString();
  const row = {
    id,
    tenantId: str(fields, 'tenantId'),
    name: str(fields, 'name'),
    description: optStr(fields, 'description'),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  db.insert(drillTypes)
    .values(row)
    .onConflictDoUpdate({
      target: drillTypes.id,
      set: {
        name: row.name,
        description: row.description,
        updatedAt: now,
        deletedAt: null,
      },
    })
    .run();
});

// ── PermitTemplate ───────────────────────────────────────────────────────────

register('PermitTemplate', (db, id, fields, _hlc, deletedAt) => {
  if (deletedAt !== null) {
    db.update(permitTemplates).set({ deletedAt }).where(eq(permitTemplates.id, id)).run();
    return;
  }
  const now = new Date().toISOString();
  const row = {
    id,
    tenantId: str(fields, 'tenantId'),
    permitType: str(fields, 'permitType') as never,
    name: str(fields, 'name'),
    checklistItemsJson: json(fields, 'checklistItemsJson'),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  db.insert(permitTemplates)
    .values(row)
    .onConflictDoUpdate({
      target: permitTemplates.id,
      set: {
        permitType: row.permitType,
        name: row.name,
        checklistItemsJson: row.checklistItemsJson,
        updatedAt: now,
        deletedAt: null,
      },
    })
    .run();
});

// ── ChecklistTemplate ────────────────────────────────────────────────────────

register('ChecklistTemplate', (db, id, fields, hlc, deletedAt) => {
  if (deletedAt !== null) {
    db.update(checklistTemplates).set({ deletedAt }).where(eq(checklistTemplates.id, id)).run();
    return;
  }
  const now = new Date().toISOString();
  const row = {
    id,
    tenantId: str(fields, 'tenantId'),
    title: str(fields, 'title'),
    description: optStr(fields, 'description'),
    itemsJson: json(fields, 'itemsJson') ?? '[]',
    createdAt: now,
    updatedAt: now,
    hlc,
    deletedAt: null,
  };
  db.insert(checklistTemplates)
    .values(row)
    .onConflictDoUpdate({
      target: checklistTemplates.id,
      set: {
        title: row.title,
        description: row.description,
        itemsJson: row.itemsJson,
        updatedAt: now,
        hlc,
        deletedAt: null,
      },
    })
    .run();
});

// ── QhseDocument ─────────────────────────────────────────────────────────────

register('QhseDocument', (db, id, fields, hlc, deletedAt) => {
  if (deletedAt !== null) {
    db.update(qhseDocuments).set({ deletedAt }).where(eq(qhseDocuments.id, id)).run();
    return;
  }
  const now = new Date().toISOString();
  const row = {
    id,
    tenantId: str(fields, 'tenantId'),
    title: str(fields, 'title'),
    category: optStr(fields, 'category'),
    description: optStr(fields, 'description'),
    isControlled: bool(fields, 'isControlled', false),
    currentRevisionId: optStr(fields, 'currentRevisionId'),
    createdAt: now,
    updatedAt: now,
    hlc,
    deletedAt: null,
  };
  db.insert(qhseDocuments)
    .values(row)
    .onConflictDoUpdate({
      target: qhseDocuments.id,
      set: {
        title: row.title,
        category: row.category,
        description: row.description,
        isControlled: row.isControlled,
        currentRevisionId: row.currentRevisionId,
        updatedAt: now,
        hlc,
        deletedAt: null,
      },
    })
    .run();
});

// ── DocumentRevision ─────────────────────────────────────────────────────────

register('DocumentRevision', (db, id, fields, hlc, deletedAt) => {
  if (deletedAt !== null) {
    db.update(documentRevisions).set({ deletedAt }).where(eq(documentRevisions.id, id)).run();
    return;
  }
  const now = new Date().toISOString();
  const row = {
    id,
    tenantId: str(fields, 'tenantId'),
    documentId: str(fields, 'documentId'),
    revisionNumber: num(fields, 'revisionNumber', 1),
    summary: optStr(fields, 'summary'),
    s3Key: str(fields, 's3Key'),
    authoredByUserId: optStr(fields, 'authoredByUserId'),
    approvedByUserId: optStr(fields, 'approvedByUserId'),
    approvedAt: optStr(fields, 'approvedAt'),
    createdAt: now,
    hlc,
    deletedAt: null,
  };
  db.insert(documentRevisions)
    .values(row)
    .onConflictDoUpdate({
      target: documentRevisions.id,
      set: {
        documentId: row.documentId,
        revisionNumber: row.revisionNumber,
        summary: row.summary,
        s3Key: row.s3Key,
        authoredByUserId: row.authoredByUserId,
        approvedByUserId: row.approvedByUserId,
        approvedAt: row.approvedAt,
        hlc,
        deletedAt: null,
      },
    })
    .run();
});

// ── FuelProduct ──────────────────────────────────────────────────────────────

register('FuelProduct', (db, id, fields, hlc, deletedAt) => {
  if (deletedAt !== null) {
    db.update(fuelProducts).set({ deletedAt }).where(eq(fuelProducts.id, id)).run();
    return;
  }
  const now = new Date().toISOString();
  const row = {
    id,
    tenantId: str(fields, 'tenantId'),
    name: str(fields, 'name'),
    tankType: str(fields, 'tankType') as never,
    sulphurPct: optStr(fields, 'sulphurPct'),
    densityKgM3: optStr(fields, 'densityKgM3'),
    createdAt: now,
    updatedAt: now,
    hlc,
    deletedAt: null,
  };
  db.insert(fuelProducts)
    .values(row)
    .onConflictDoUpdate({
      target: fuelProducts.id,
      set: {
        name: row.name,
        tankType: row.tankType,
        sulphurPct: row.sulphurPct,
        densityKgM3: row.densityKgM3,
        updatedAt: now,
        hlc,
        deletedAt: null,
      },
    })
    .run();
});

// ── Jha ──────────────────────────────────────────────────────────────────────

register('Jha', (db, id, fields, hlc, deletedAt) => {
  if (deletedAt !== null) {
    db.update(jhas).set({ deletedAt }).where(eq(jhas.id, id)).run();
    return;
  }
  const now = new Date().toISOString();
  const row = {
    id,
    tenantId: str(fields, 'tenantId'),
    ref: str(fields, 'ref'),
    title: str(fields, 'title'),
    activity: optStr(fields, 'activity'),
    hazards: json(fields, 'hazards') ?? '[]',
    controls: json(fields, 'controls') ?? '[]',
    residualL: num(fields, 'residualL', 1),
    residualS: num(fields, 'residualS', 1),
    reviewedAt: optStr(fields, 'reviewedAt'),
    reviewedBy: optStr(fields, 'reviewedBy'),
    createdAt: now,
    updatedAt: now,
    hlc,
    deletedAt: null,
  };
  db.insert(jhas)
    .values(row)
    .onConflictDoUpdate({
      target: jhas.id,
      set: {
        ref: row.ref,
        title: row.title,
        activity: row.activity,
        hazards: row.hazards,
        controls: row.controls,
        residualL: row.residualL,
        residualS: row.residualS,
        reviewedAt: row.reviewedAt,
        reviewedBy: row.reviewedBy,
        updatedAt: now,
        hlc,
        deletedAt: null,
      },
    })
    .run();
});

// ── QhseObjective ────────────────────────────────────────────────────────────

register('QhseObjective', (db, id, fields, hlc, deletedAt) => {
  if (deletedAt !== null) {
    db.update(qhseObjectives).set({ deletedAt }).where(eq(qhseObjectives.id, id)).run();
    return;
  }
  const now = new Date().toISOString();
  const row = {
    id,
    tenantId: str(fields, 'tenantId'),
    category: str(fields, 'category') as never,
    label: str(fields, 'label'),
    target: str(fields, 'target'),
    actual: str(fields, 'actual'),
    unit: str(fields, 'unit'),
    status: str(fields, 'status', 'GREEN') as never,
    delta: optStr(fields, 'delta'),
    trend: json(fields, 'trend'),
    periodFrom: optStr(fields, 'periodFrom'),
    periodTo: optStr(fields, 'periodTo'),
    createdAt: now,
    updatedAt: now,
    hlc,
    deletedAt: null,
  };
  db.insert(qhseObjectives)
    .values(row)
    .onConflictDoUpdate({
      target: qhseObjectives.id,
      set: {
        category: row.category,
        label: row.label,
        target: row.target,
        actual: row.actual,
        unit: row.unit,
        status: row.status,
        delta: row.delta,
        trend: row.trend,
        periodFrom: row.periodFrom,
        periodTo: row.periodTo,
        updatedAt: now,
        hlc,
        deletedAt: null,
      },
    })
    .run();
});

// ── DrybmsElement ────────────────────────────────────────────────────────────

register('DrybmsElement', (db, id, fields, hlc, deletedAt) => {
  if (deletedAt !== null) {
    db.update(drybmsElements).set({ deletedAt }).where(eq(drybmsElements.id, id)).run();
    return;
  }
  const now = new Date().toISOString();
  const row = {
    id,
    tenantId: str(fields, 'tenantId'),
    chapter: str(fields, 'chapter'),
    chapterTitle: str(fields, 'chapterTitle'),
    name: str(fields, 'name'),
    score: num(fields, 'score', 1),
    stage: optStr(fields, 'stage'),
    evidence: optStr(fields, 'evidence'),
    createdAt: now,
    updatedAt: now,
    hlc,
    deletedAt: null,
  };
  db.insert(drybmsElements)
    .values(row)
    .onConflictDoUpdate({
      target: drybmsElements.id,
      set: {
        chapter: row.chapter,
        chapterTitle: row.chapterTitle,
        name: row.name,
        score: row.score,
        stage: row.stage,
        evidence: row.evidence,
        updatedAt: now,
        hlc,
        deletedAt: null,
      },
    })
    .run();
});

// ── ManagementReview ─────────────────────────────────────────────────────────

register('ManagementReview', (db, id, fields, hlc, deletedAt) => {
  if (deletedAt !== null) {
    db.update(managementReviews).set({ deletedAt }).where(eq(managementReviews.id, id)).run();
    return;
  }
  const now = new Date().toISOString();
  const row = {
    id,
    tenantId: str(fields, 'tenantId'),
    kind: str(fields, 'kind'),
    scheduledAt: str(fields, 'scheduledAt'),
    chair: str(fields, 'chair'),
    attendees: num(fields, 'attendees', 0),
    status: str(fields, 'status', 'SCHEDULED') as never,
    actionsTotal: num(fields, 'actionsTotal', 0),
    actionsDone: num(fields, 'actionsDone', 0),
    summary: optStr(fields, 'summary'),
    createdAt: now,
    updatedAt: now,
    hlc,
    deletedAt: null,
  };
  db.insert(managementReviews)
    .values(row)
    .onConflictDoUpdate({
      target: managementReviews.id,
      set: {
        kind: row.kind,
        scheduledAt: row.scheduledAt,
        chair: row.chair,
        attendees: row.attendees,
        status: row.status,
        actionsTotal: row.actionsTotal,
        actionsDone: row.actionsDone,
        summary: row.summary,
        updatedAt: now,
        hlc,
        deletedAt: null,
      },
    })
    .run();
});

/**
 * Single entry point — call from DrizzleSyncAdapter after sync_records
 * upsert. Returns true if a materialiser ran, false if none registered
 * for this entityType (vessel-scoped entities — those are written by
 * their own OutboxRecorder path, not through here).
 */
export function materialiseTenantEntity(
  db: Db,
  entityType: string,
  entityId: string,
  fields: LwwRecord,
  hlc: string,
  deletedAt: string | null,
): boolean {
  const fn = tenantMaterialisers[entityType];
  if (fn === undefined) return false;
  fn(db, entityId, fields, hlc, deletedAt);
  return true;
}
