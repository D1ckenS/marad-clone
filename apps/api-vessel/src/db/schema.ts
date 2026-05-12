import { check, index, integer, numeric, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const ROLES = [
  'SUPER_ADMIN',
  'TENANT_ADMIN',
  'PURCHASE_MANAGER',
  'MASTER',
  'CHIEF_ENGINEER',
  'OFFICER',
  'CREW',
] as const;

export type Role = (typeof ROLES)[number];

export const JOB_INSTANCE_STATUSES = ['PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED'] as const;
export type JobInstanceStatus = (typeof JOB_INSTANCE_STATUSES)[number];

export const JOB_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;
export type JobPriority = (typeof JOB_PRIORITIES)[number];

export const RUNNING_HOUR_SOURCES = ['MANUAL', 'API', 'PLC'] as const;
export type RunningHourSource = (typeof RUNNING_HOUR_SOURCES)[number];

const nowIso = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull().default(nowIso),
  updatedAt: text('updated_at').notNull().default(nowIso),
  hlc: text('hlc'),
  deletedAt: text('deleted_at'),
});

export const vessels = sqliteTable('vessels', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id),
  name: text('name').notNull(),
  imoNumber: text('imo_number'),
  createdAt: text('created_at').notNull().default(nowIso),
  updatedAt: text('updated_at').notNull().default(nowIso),
  hlc: text('hlc'),
  deletedAt: text('deleted_at'),
});

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id').references(() => vessels.id),
    email: text('email').notNull(),
    passwordHash: text('password_hash'),
    role: text('role', { enum: ROLES }).notNull().default('OFFICER'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [unique('users_tenant_email_uniq').on(t.tenantId, t.email)],
);

// ── Maintenance (P1-1) ──────────────────────────────────────────────────────
// Mirrors the Prisma maintenance schema 1:1 (table names, column names,
// types). SQLite stores Decimal as TEXT via drizzle's `numeric` to keep
// precision; the wire-protocol layer round-trips via string. JobHistory
// immutability is enforced by a BEFORE UPDATE trigger added in the
// hand-edited Drizzle migration alongside this schema.

export const masterComponents = sqliteTable(
  'master_components',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    description: text('description'),
    sfi: text('sfi'),
    category: text('category'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('master_components_tenant_idx').on(t.tenantId)],
);

export const components = sqliteTable(
  'components',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    parentId: text('parent_id'),
    masterId: text('master_id').references(() => masterComponents.id),
    name: text('name').notNull(),
    description: text('description'),
    sfi: text('sfi'),
    runningHours: numeric('running_hours').notNull().default('0'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('components_tenant_vessel_idx').on(t.tenantId, t.vesselId),
    index('components_tenant_vessel_parent_idx').on(t.tenantId, t.vesselId, t.parentId),
  ],
);

export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    componentId: text('component_id')
      .notNull()
      .references(() => components.id),
    title: text('title').notNull(),
    description: text('description'),
    intervalDays: integer('interval_days'),
    intervalRunningHours: numeric('interval_running_hours'),
    estimatedHours: numeric('estimated_hours'),
    priority: text('priority', { enum: JOB_PRIORITIES }).notNull().default('NORMAL'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('jobs_tenant_vessel_component_idx').on(t.tenantId, t.vesselId, t.componentId),
    check(
      'jobs_interval_required_chk',
      sql`(${t.intervalDays} IS NOT NULL OR ${t.intervalRunningHours} IS NOT NULL)`,
    ),
  ],
);

export const jobInstances = sqliteTable(
  'job_instances',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id),
    componentId: text('component_id')
      .notNull()
      .references(() => components.id),
    status: text('status', { enum: JOB_INSTANCE_STATUSES }).notNull().default('PENDING'),
    dueAt: text('due_at'),
    dueAtRunningHours: numeric('due_at_running_hours'),
    assignedToUserId: text('assigned_to_user_id'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('job_instances_tenant_vessel_status_due_idx').on(
      t.tenantId,
      t.vesselId,
      t.status,
      t.dueAt,
    ),
    index('job_instances_tenant_vessel_component_idx').on(t.tenantId, t.vesselId, t.componentId),
  ],
);

export const jobHistories = sqliteTable(
  'job_histories',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    jobInstanceId: text('job_instance_id')
      .notNull()
      .references(() => jobInstances.id),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id),
    componentId: text('component_id')
      .notNull()
      .references(() => components.id),
    completedAt: text('completed_at').notNull(),
    completedByUserId: text('completed_by_user_id').notNull(),
    hoursWorked: numeric('hours_worked'),
    notes: text('notes'),
    signatureHash: text('signature_hash'),
    partsConsumed: text('parts_consumed'),
    photos: text('photos'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('job_histories_tenant_vessel_completed_idx').on(t.tenantId, t.vesselId, t.completedAt),
    index('job_histories_tenant_vessel_instance_idx').on(t.tenantId, t.vesselId, t.jobInstanceId),
  ],
);

export const runningHourReadings = sqliteTable(
  'running_hour_readings',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    componentId: text('component_id')
      .notNull()
      .references(() => components.id),
    value: numeric('value').notNull(),
    source: text('source', { enum: RUNNING_HOUR_SOURCES }).notNull(),
    recordedAt: text('recorded_at').notNull(),
    recordedByUserId: text('recorded_by_user_id'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('running_hour_readings_tenant_vessel_component_recorded_idx').on(
      t.tenantId,
      t.vesselId,
      t.componentId,
      t.recordedAt,
    ),
  ],
);

// Sync engine outbox. Pending entries have sent_at = null.
export const outbox = sqliteTable(
  'outbox',
  {
    id: text('id').primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    operation: text('operation', { enum: ['upsert', 'delete'] }).notNull(),
    payload: text('payload'), // JSON-encoded LwwRecord, null for deletes
    hlc: text('hlc').notNull(),
    nodeId: text('node_id').notNull(),
    sentAt: integer('sent_at'), // unix ms; null = pending
    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
  },
  (t) => [
    index('outbox_pending_idx').on(t.sentAt, t.createdAt),
    index('outbox_entity_idx').on(t.entityType, t.entityId),
  ],
);

// Snapshot of remote-applied state per (entity_type, entity_id) — keeps the
// per-field LWW record for merge decisions. Materialised view of incoming
// deltas after conflict resolution.
export const syncRecords = sqliteTable(
  'sync_records',
  {
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    hlc: text('hlc').notNull(),
    deletedAt: text('deleted_at'),
    fields: text('fields').notNull(), // JSON LwwRecord
  },
  (t) => [unique('sync_records_pk').on(t.entityType, t.entityId)],
);
