import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
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
