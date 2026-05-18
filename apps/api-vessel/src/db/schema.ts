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
    typicalPartsJson: text('typical_parts_json'),
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

// ── Inventory (P1-5) ─────────────────────────────────────────────────────────
// Mirrors the Prisma inventory schema. PartCategory and Part are tenant-scoped
// (no vessel_id) — fleet-wide catalogs replicated shore→vessel. StockLocation,
// StockLevel, and StockMovement are vessel-scoped. BarcodeBinding is
// tenant-scoped (fleet-wide barcode→part map).
// Quantity in StockMovement is signed: + = stock in, − = stock out.
// ROB = SUM(quantity) per (tenant, vessel, part, location).

export const partCategories = sqliteTable(
  'part_categories',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    parentId: text('parent_id'), // soft self-FK — SQLite cannot enforce circular FK
    name: text('name').notNull(),
    description: text('description'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('part_categories_tenant_idx').on(t.tenantId)],
);

export const parts = sqliteTable(
  'parts',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    categoryId: text('category_id').references(() => partCategories.id),
    name: text('name').notNull(),
    description: text('description'),
    partNumber: text('part_number'),
    unit: text('unit').notNull().default('pcs'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('parts_tenant_idx').on(t.tenantId),
    index('parts_tenant_part_number_idx').on(t.tenantId, t.partNumber),
  ],
);

export const stockLocations = sqliteTable(
  'stock_locations',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('stock_locations_tenant_vessel_idx').on(t.tenantId, t.vesselId)],
);

export const stockLevels = sqliteTable(
  'stock_levels',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    partId: text('part_id')
      .notNull()
      .references(() => parts.id),
    locationId: text('location_id')
      .notNull()
      .references(() => stockLocations.id),
    minStock: numeric('min_stock').notNull().default('0'),
    maxStock: numeric('max_stock'),
    reorderPoint: numeric('reorder_point'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    unique('stock_levels_vessel_part_location_uniq').on(
      t.tenantId,
      t.vesselId,
      t.partId,
      t.locationId,
    ),
    index('stock_levels_tenant_vessel_idx').on(t.tenantId, t.vesselId),
  ],
);

export const STOCK_MOVEMENT_TYPES = [
  'CONSUMPTION',
  'RECEIPT',
  'ADJUSTMENT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const stockMovements = sqliteTable(
  'stock_movements',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    partId: text('part_id')
      .notNull()
      .references(() => parts.id),
    locationId: text('location_id')
      .notNull()
      .references(() => stockLocations.id),
    movementType: text('movement_type', { enum: STOCK_MOVEMENT_TYPES }).notNull(),
    quantity: numeric('quantity').notNull(), // signed: + = in, − = out
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    notes: text('notes'),
    recordedByUserId: text('recorded_by_user_id'),
    recordedAt: text('recorded_at').notNull(),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('stock_movements_tenant_vessel_part_location_idx').on(
      t.tenantId,
      t.vesselId,
      t.partId,
      t.locationId,
    ),
    index('stock_movements_tenant_vessel_type_recorded_idx').on(
      t.tenantId,
      t.vesselId,
      t.movementType,
      t.recordedAt,
    ),
  ],
);

export const barcodeBindings = sqliteTable(
  'barcode_bindings',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    partId: text('part_id')
      .notNull()
      .references(() => parts.id),
    barcode: text('barcode').notNull(),
    createdByUserId: text('created_by_user_id'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    unique('barcode_bindings_tenant_barcode_uniq').on(t.tenantId, t.barcode),
    index('barcode_bindings_tenant_part_idx').on(t.tenantId, t.partId),
  ],
);

// ── Purchase (P1-7) ──────────────────────────────────────────────────────────
// Mirrors the Prisma purchase schema. Supplier, ApprovalFlow, and ApprovalStep
// are tenant-scoped only (fleet-wide catalogs replicated shore→vessel).
// All vessel-scoped purchase entities carry tenantId + vesselId.
// Money amounts stored as TEXT via numeric() to preserve precision.

export const REQUISITION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;
export type RequisitionStatus = (typeof REQUISITION_STATUSES)[number];

export const PURCHASE_ORDER_STATUSES = [
  'DRAFT',
  'SENT',
  'ACKNOWLEDGED',
  'IN_TRANSIT',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CLOSED',
  'CANCELLED',
] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export const RFQ_STATUSES = ['DRAFT', 'SENT', 'CLOSED'] as const;
export type RfqStatus = (typeof RFQ_STATUSES)[number];

export const QUOTE_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const suppliers = sqliteTable(
  'suppliers',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    contactName: text('contact_name'),
    contactEmail: text('contact_email'),
    contactPhone: text('contact_phone'),
    address: text('address'),
    country: text('country'),
    notes: text('notes'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('suppliers_tenant_idx').on(t.tenantId)],
);

export const approvalFlows = sqliteTable(
  'approval_flows',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    description: text('description'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('approval_flows_tenant_idx').on(t.tenantId)],
);

export const approvalSteps = sqliteTable(
  'approval_steps',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    flowId: text('flow_id')
      .notNull()
      .references(() => approvalFlows.id),
    stepOrder: integer('step_order').notNull(),
    approverRole: text('approver_role', { enum: ROLES }).notNull(),
    limitAmount: numeric('limit_amount'),
    limitCurrency: text('limit_currency').notNull().default('USD'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    unique('approval_steps_flow_order_uniq').on(t.flowId, t.stepOrder),
    index('approval_steps_tenant_idx').on(t.tenantId),
  ],
);

export const requisitions = sqliteTable(
  'requisitions',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    title: text('title').notNull(),
    notes: text('notes'),
    status: text('status', { enum: REQUISITION_STATUSES }).notNull().default('DRAFT'),
    totalAmount: numeric('total_amount').notNull().default('0'),
    currency: text('currency').notNull().default('USD'),
    requestedByUserId: text('requested_by_user_id'),
    requestedAt: text('requested_at').notNull(),
    approvalFlowId: text('approval_flow_id').references(() => approvalFlows.id),
    currentStepOrder: integer('current_step_order').notNull().default(0),
    approvedByUserId: text('approved_by_user_id'),
    approvedAt: text('approved_at'),
    rejectedByUserId: text('rejected_by_user_id'),
    rejectedAt: text('rejected_at'),
    rejectionReason: text('rejection_reason'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('requisitions_tenant_vessel_status_idx').on(t.tenantId, t.vesselId, t.status),
    index('requisitions_tenant_vessel_requested_idx').on(t.tenantId, t.vesselId, t.requestedAt),
    // APPROVED requires an approver — same invariant as Postgres CHECK
    check(
      'requisitions_approved_requires_approver_chk',
      sql`(${t.status} != 'APPROVED' OR ${t.approvedByUserId} IS NOT NULL)`,
    ),
  ],
);

export const requisitionLines = sqliteTable(
  'requisition_lines',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    requisitionId: text('requisition_id')
      .notNull()
      .references(() => requisitions.id),
    partId: text('part_id').references(() => parts.id),
    description: text('description').notNull(),
    quantity: numeric('quantity').notNull(),
    unit: text('unit').notNull().default('pcs'),
    estimatedUnitPrice: numeric('estimated_unit_price'),
    estimatedTotalPrice: numeric('estimated_total_price'),
    currency: text('currency'),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('requisition_lines_tenant_vessel_req_idx').on(t.tenantId, t.vesselId, t.requisitionId),
  ],
);

export const rfqs = sqliteTable(
  'rfqs',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    requisitionId: text('requisition_id').references(() => requisitions.id),
    title: text('title').notNull(),
    notes: text('notes'),
    status: text('status', { enum: RFQ_STATUSES }).notNull().default('DRAFT'),
    issuedAt: text('issued_at'),
    dueAt: text('due_at'),
    createdByUserId: text('created_by_user_id'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('rfqs_tenant_vessel_status_idx').on(t.tenantId, t.vesselId, t.status)],
);

export const quotes = sqliteTable(
  'quotes',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    rfqId: text('rfq_id')
      .notNull()
      .references(() => rfqs.id),
    supplierId: text('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    validUntil: text('valid_until'),
    totalAmount: numeric('total_amount').notNull().default('0'),
    currency: text('currency').notNull().default('USD'),
    notes: text('notes'),
    status: text('status', { enum: QUOTE_STATUSES }).notNull().default('PENDING'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('quotes_tenant_vessel_rfq_idx').on(t.tenantId, t.vesselId, t.rfqId)],
);

export const quoteLines = sqliteTable(
  'quote_lines',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id),
    partId: text('part_id').references(() => parts.id),
    description: text('description').notNull(),
    quantity: numeric('quantity').notNull(),
    unit: text('unit').notNull().default('pcs'),
    unitPrice: numeric('unit_price').notNull(),
    totalPrice: numeric('total_price').notNull(),
    currency: text('currency').notNull().default('USD'),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('quote_lines_tenant_vessel_quote_idx').on(t.tenantId, t.vesselId, t.quoteId)],
);

export const purchaseOrders = sqliteTable(
  'purchase_orders',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    requisitionId: text('requisition_id').references(() => requisitions.id),
    rfqId: text('rfq_id').references(() => rfqs.id),
    supplierId: text('supplier_id').references(() => suppliers.id),
    poNumber: text('po_number'),
    title: text('title').notNull(),
    notes: text('notes'),
    status: text('status', { enum: PURCHASE_ORDER_STATUSES }).notNull().default('DRAFT'),
    totalAmount: numeric('total_amount').notNull().default('0'),
    currency: text('currency').notNull().default('USD'),
    orderedByUserId: text('ordered_by_user_id'),
    orderedAt: text('ordered_at'),
    expectedDeliveryAt: text('expected_delivery_at'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('purchase_orders_tenant_vessel_status_idx').on(t.tenantId, t.vesselId, t.status),
    index('purchase_orders_tenant_vessel_supplier_idx').on(t.tenantId, t.vesselId, t.supplierId),
    // Supplier required once PO leaves DRAFT
    check(
      'purchase_orders_non_draft_requires_supplier_chk',
      sql`(${t.status} = 'DRAFT' OR ${t.supplierId} IS NOT NULL)`,
    ),
  ],
);

export const poLines = sqliteTable(
  'po_lines',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    poId: text('po_id')
      .notNull()
      .references(() => purchaseOrders.id),
    partId: text('part_id').references(() => parts.id),
    description: text('description').notNull(),
    quantity: numeric('quantity').notNull(),
    unit: text('unit').notNull().default('pcs'),
    unitPrice: numeric('unit_price').notNull(),
    totalPrice: numeric('total_price').notNull(),
    currency: text('currency').notNull().default('USD'),
    requisitionLineId: text('requisition_line_id').references(() => requisitionLines.id),
    quoteLineId: text('quote_line_id'), // soft FK — traceability only
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('po_lines_tenant_vessel_po_idx').on(t.tenantId, t.vesselId, t.poId)],
);

export const goodsReceipts = sqliteTable(
  'goods_receipts',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    poId: text('po_id')
      .notNull()
      .references(() => purchaseOrders.id),
    receivedByUserId: text('received_by_user_id'),
    receivedAt: text('received_at').notNull(),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('goods_receipts_tenant_vessel_po_idx').on(t.tenantId, t.vesselId, t.poId)],
);

export const goodsReceiptLines = sqliteTable(
  'goods_receipt_lines',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    receiptId: text('receipt_id')
      .notNull()
      .references(() => goodsReceipts.id),
    poLineId: text('po_line_id')
      .notNull()
      .references(() => poLines.id),
    partId: text('part_id').references(() => parts.id),
    description: text('description'),
    quantityOrdered: numeric('quantity_ordered').notNull(),
    quantityReceived: numeric('quantity_received').notNull(),
    unit: text('unit').notNull().default('pcs'),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('goods_receipt_lines_tenant_vessel_receipt_idx').on(t.tenantId, t.vesselId, t.receiptId),
    index('goods_receipt_lines_tenant_vessel_po_line_idx').on(t.tenantId, t.vesselId, t.poLineId),
  ],
);

// ── Certificates (P2-1) ──────────────────────────────────────────────────────

export const CERTIFICATE_SUBJECT_TYPES = ['VESSEL', 'COMPONENT', 'CREW_MEMBER'] as const;
export type CertificateSubjectType = (typeof CERTIFICATE_SUBJECT_TYPES)[number];

export const certificateTypes = sqliteTable(
  'certificate_types',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    description: text('description'),
    alertDaysJson: text('alert_days_json'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('certificate_types_tenant_idx').on(t.tenantId)],
);

export const certificates = sqliteTable(
  'certificates',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id').references(() => vessels.id),
    certificateTypeId: text('certificate_type_id')
      .notNull()
      .references(() => certificateTypes.id),
    subjectType: text('subject_type', { enum: CERTIFICATE_SUBJECT_TYPES }).notNull(),
    subjectId: text('subject_id').notNull(),
    number: text('number'),
    issuedAt: text('issued_at'),
    expiresAt: text('expires_at'),
    issuedBy: text('issued_by'),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('certificates_tenant_vessel_idx').on(t.tenantId, t.vesselId),
    index('certificates_tenant_subject_idx').on(t.tenantId, t.subjectType, t.subjectId),
    index('certificates_tenant_expires_idx').on(t.tenantId, t.expiresAt),
  ],
);

export const certificateAttachments = sqliteTable(
  'certificate_attachments',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id').references(() => vessels.id),
    certificateId: text('certificate_id')
      .notNull()
      .references(() => certificates.id),
    fileName: text('file_name').notNull(),
    storageKey: text('storage_key').notNull(),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes'),
    uploadedAt: text('uploaded_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('certificate_attachments_cert_idx').on(t.tenantId, t.certificateId)],
);

// ── Safety (P2-2) ──────────────────────────────────────────────────────────────

export const DRILL_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED'] as const;
export type DrillStatus = (typeof DRILL_STATUSES)[number];

export const WORK_PERMIT_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'ACTIVE',
  'CLOSED',
  'CANCELLED',
] as const;
export type WorkPermitStatus = (typeof WORK_PERMIT_STATUSES)[number];

export const WORK_PERMIT_TYPES = [
  'HOT_WORK',
  'CONFINED_SPACE',
  'WORKING_AT_HEIGHT',
  'ELECTRICAL_ISOLATION',
  'COLD_WORK',
  'DIVING',
  'OVERSIDE_WORK',
] as const;
export type WorkPermitType = (typeof WORK_PERMIT_TYPES)[number];

export const drillTypes = sqliteTable(
  'drill_types',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    unique('drill_types_tenant_name_uniq').on(t.tenantId, t.name),
    index('drill_types_tenant_idx').on(t.tenantId),
  ],
);

export const drills = sqliteTable(
  'drills',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    drillTypeId: text('drill_type_id')
      .notNull()
      .references(() => drillTypes.id),
    status: text('status', { enum: DRILL_STATUSES }).notNull().default('SCHEDULED'),
    scheduledAt: text('scheduled_at').notNull(),
    conductedAt: text('conducted_at'),
    durationMinutes: integer('duration_minutes'),
    location: text('location'),
    leadOfficer: text('lead_officer'),
    notes: text('notes'),
    reportKey: text('report_key'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('drills_tenant_vessel_status_idx').on(t.tenantId, t.vesselId, t.status),
    index('drills_tenant_vessel_scheduled_idx').on(t.tenantId, t.vesselId, t.scheduledAt),
  ],
);

export const drillRecords = sqliteTable(
  'drill_records',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    drillId: text('drill_id')
      .notNull()
      .references(() => drills.id),
    participantName: text('participant_name').notNull(),
    role: text('role'),
    signedAt: text('signed_at'),
    signatureHash: text('signature_hash'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('drill_records_tenant_vessel_drill_idx').on(t.tenantId, t.vesselId, t.drillId)],
);

export const permitTemplates = sqliteTable(
  'permit_templates',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    permitType: text('permit_type', { enum: WORK_PERMIT_TYPES }).notNull(),
    name: text('name').notNull(),
    checklistItemsJson: text('checklist_items_json'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('permit_templates_tenant_idx').on(t.tenantId)],
);

export const workPermits = sqliteTable(
  'work_permits',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    permitType: text('permit_type', { enum: WORK_PERMIT_TYPES }).notNull(),
    templateId: text('template_id').references(() => permitTemplates.id),
    status: text('status', { enum: WORK_PERMIT_STATUSES }).notNull().default('REQUESTED'),
    title: text('title').notNull(),
    location: text('location'),
    workDescription: text('work_description'),
    requestedByUserId: text('requested_by_user_id'),
    validFrom: text('valid_from'),
    validUntil: text('valid_until'),
    closedAt: text('closed_at'),
    riskAssessmentJson: text('risk_assessment_json'),
    gasTestJson: text('gas_test_json'),
    hazardsJson: text('hazards_json'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('work_permits_tenant_vessel_status_idx').on(t.tenantId, t.vesselId, t.status),
    index('work_permits_tenant_vessel_type_idx').on(t.tenantId, t.vesselId, t.permitType),
    // HOT_WORK permit cannot be ACTIVE without risk_assessment_json
    check(
      'work_permits_hot_work_active_needs_risk_chk',
      sql`NOT (${t.permitType} = 'HOT_WORK' AND ${t.status} = 'ACTIVE' AND ${t.riskAssessmentJson} IS NULL)`,
    ),
  ],
);

export const permitApprovals = sqliteTable(
  'permit_approvals',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    permitId: text('permit_id')
      .notNull()
      .references(() => workPermits.id),
    approvedBy: text('approved_by').notNull(),
    role: text('role').notNull(),
    approvedAt: text('approved_at').notNull(),
    signatureHash: text('signature_hash'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('permit_approvals_tenant_vessel_permit_idx').on(t.tenantId, t.vesselId, t.permitId),
  ],
);

// ── QHSE (P2-3) ──────────────────────────────────────────────────────────────

export const FINDING_KINDS = ['NEAR_MISS', 'NON_CONFORMANCE', 'OBSERVATION', 'HAZARD'] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

export const FINDING_STATUSES = ['OPEN', 'UNDER_REVIEW', 'CLOSED'] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const CAPA_STATUSES = ['OPEN', 'IN_PROGRESS', 'VERIFIED', 'CLOSED'] as const;
export type CapaStatus = (typeof CAPA_STATUSES)[number];

export const CHECKLIST_INSTANCE_STATUSES = ['IN_PROGRESS', 'COMPLETED'] as const;
export type ChecklistInstanceStatus = (typeof CHECKLIST_INSTANCE_STATUSES)[number];

export const qhseDocuments = sqliteTable(
  'qhse_documents',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    title: text('title').notNull(),
    category: text('category'),
    description: text('description'),
    isControlled: integer('is_controlled', { mode: 'boolean' }).notNull().default(false),
    currentRevisionId: text('current_revision_id'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('qhse_documents_tenant_idx').on(t.tenantId)],
);

export const documentRevisions = sqliteTable(
  'document_revisions',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    documentId: text('document_id')
      .notNull()
      .references(() => qhseDocuments.id),
    revisionNumber: integer('revision_number').notNull(),
    summary: text('summary'),
    s3Key: text('s3_key').notNull(),
    authoredByUserId: text('authored_by_user_id'),
    approvedByUserId: text('approved_by_user_id'),
    approvedAt: text('approved_at'),
    createdAt: text('created_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    unique('document_revisions_doc_rev_uniq').on(t.documentId, t.revisionNumber),
    index('document_revisions_tenant_doc_idx').on(t.tenantId, t.documentId),
  ],
);

export const checklistTemplates = sqliteTable(
  'checklist_templates',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    title: text('title').notNull(),
    description: text('description'),
    itemsJson: text('items_json').notNull(),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('checklist_templates_tenant_idx').on(t.tenantId)],
);

export const checklistInstances = sqliteTable(
  'checklist_instances',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    templateId: text('template_id').references(() => checklistTemplates.id),
    title: text('title').notNull(),
    status: text('status', { enum: CHECKLIST_INSTANCE_STATUSES }).notNull().default('IN_PROGRESS'),
    responsesJson: text('responses_json').notNull().default('[]'),
    completedAt: text('completed_at'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('checklist_instances_tenant_vessel_status_idx').on(t.tenantId, t.vesselId, t.status),
  ],
);

export const findings = sqliteTable(
  'findings',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    kind: text('kind', { enum: FINDING_KINDS }).notNull(),
    status: text('status', { enum: FINDING_STATUSES }).notNull().default('OPEN'),
    title: text('title').notNull(),
    description: text('description'),
    raisedByUserId: text('raised_by_user_id'),
    raisedAt: text('raised_at').notNull(),
    closedAt: text('closed_at'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('findings_tenant_vessel_status_idx').on(t.tenantId, t.vesselId, t.status),
    index('findings_tenant_vessel_kind_idx').on(t.tenantId, t.vesselId, t.kind),
  ],
);

export const capas = sqliteTable(
  'capas',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    findingId: text('finding_id').references(() => findings.id),
    type: text('type').notNull(),
    description: text('description').notNull(),
    ownerUserId: text('owner_user_id'),
    dueDate: text('due_date'),
    status: text('status', { enum: CAPA_STATUSES }).notNull().default('OPEN'),
    verifiedAt: text('verified_at'),
    closedAt: text('closed_at'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('capas_tenant_vessel_status_idx').on(t.tenantId, t.vesselId, t.status),
    index('capas_tenant_vessel_finding_idx').on(t.tenantId, t.vesselId, t.findingId),
  ],
);

// ── FLGO (P3-1) ─────────────────────────────────────────────────────────────

export const TANK_TYPES = [
  'HFO',
  'LSFO',
  'MDO',
  'MGO',
  'LSMGO',
  'LNG',
  'ULSFO',
  'FRESH_WATER',
  'BALLAST',
  'OTHER',
] as const;
export type TankType = (typeof TANK_TYPES)[number];

export const CONSUMER_TYPES = ['MAIN_ENGINE', 'AUX_ENGINE', 'BOILER', 'OTHER'] as const;
export type ConsumerType = (typeof CONSUMER_TYPES)[number];

export const fuelProducts = sqliteTable(
  'fuel_products',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    tankType: text('tank_type', { enum: TANK_TYPES }).notNull(),
    sulphurPct: numeric('sulphur_pct'),
    densityKgM3: numeric('density_kg_m3'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('fuel_products_tenant_idx').on(t.tenantId)],
);

export const tanks = sqliteTable(
  'tanks',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    name: text('name').notNull(),
    tankType: text('tank_type', { enum: TANK_TYPES }).notNull(),
    fuelProductId: text('fuel_product_id').references(() => fuelProducts.id),
    capacityM3: numeric('capacity_m3'),
    framePosition: text('frame_position'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('tanks_tenant_vessel_idx').on(t.tenantId, t.vesselId)],
);

export const tankReadings = sqliteTable(
  'tank_readings',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    tankId: text('tank_id')
      .notNull()
      .references(() => tanks.id),
    readingDate: text('reading_date').notNull(),
    robMt: numeric('rob_mt').notNull(),
    robM3: numeric('rob_m3'),
    trim: numeric('trim'),
    notes: text('notes'),
    recordedByUserId: text('recorded_by_user_id'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    unique('tank_readings_unique_day').on(t.tenantId, t.vesselId, t.tankId, t.readingDate),
    index('tank_readings_tenant_vessel_date_idx').on(t.tenantId, t.vesselId, t.readingDate),
  ],
);

export const bunkerDeliveryNotes = sqliteTable(
  'bunker_delivery_notes',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    fuelProductId: text('fuel_product_id').references(() => fuelProducts.id),
    bdnNumber: text('bdn_number'),
    deliveryDate: text('delivery_date').notNull(),
    port: text('port'),
    supplierName: text('supplier_name'),
    quantityMt: numeric('quantity_mt').notNull(),
    densityKgM3: numeric('density_kg_m3'),
    sulphurPct: numeric('sulphur_pct'),
    grade: text('grade'),
    viscosity: numeric('viscosity'),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('bdn_tenant_vessel_date_idx').on(t.tenantId, t.vesselId, t.deliveryDate)],
);

export const consumptionLogs = sqliteTable(
  'consumption_logs',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    fuelProductId: text('fuel_product_id').references(() => fuelProducts.id),
    logDate: text('log_date').notNull(),
    consumerType: text('consumer_type', { enum: CONSUMER_TYPES }).notNull(),
    consumerName: text('consumer_name'),
    consumptionMt: numeric('consumption_mt').notNull(),
    voyageLeg: text('voyage_leg'),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('consumption_logs_tenant_vessel_date_idx').on(t.tenantId, t.vesselId, t.logDate),
    index('consumption_logs_tenant_vessel_consumer_idx').on(t.tenantId, t.vesselId, t.consumerType),
  ],
);

// ── Crewing (P2-4) ──────────────────────────────────────────────────────────

export const CREW_MEMBER_STATUSES = ['ACTIVE', 'ON_LEAVE', 'SIGNED_OFF'] as const;
export type CrewMemberStatus = (typeof CREW_MEMBER_STATUSES)[number];

export const ROTATION_STATUSES = ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
export type RotationStatus = (typeof ROTATION_STATUSES)[number];

export const crewMembers = sqliteTable(
  'crew_members',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    rank: text('rank').notNull(),
    nationality: text('nationality'),
    dateOfBirth: text('date_of_birth'),
    email: text('email'),
    phone: text('phone'),
    status: text('status', { enum: CREW_MEMBER_STATUSES }).notNull().default('ACTIVE'),
    signOnDate: text('sign_on_date'),
    signOffDate: text('sign_off_date'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('crew_members_tenant_vessel_idx').on(t.tenantId, t.vesselId),
    index('crew_members_tenant_vessel_status_idx').on(t.tenantId, t.vesselId, t.status),
  ],
);

export const rotations = sqliteTable(
  'rotations',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    crewMemberId: text('crew_member_id')
      .notNull()
      .references(() => crewMembers.id),
    plannedSignOn: text('planned_sign_on').notNull(),
    plannedSignOff: text('planned_sign_off').notNull(),
    actualSignOn: text('actual_sign_on'),
    actualSignOff: text('actual_sign_off'),
    status: text('status', { enum: ROTATION_STATUSES }).notNull().default('PLANNED'),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('rotations_tenant_vessel_crew_idx').on(t.tenantId, t.vesselId, t.crewMemberId),
    index('rotations_tenant_vessel_status_idx').on(t.tenantId, t.vesselId, t.status),
  ],
);

export const restHourEntries = sqliteTable(
  'rest_hour_entries',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    crewMemberId: text('crew_member_id')
      .notNull()
      .references(() => crewMembers.id),
    date: text('date').notNull(),
    hoursWorkedJson: text('hours_worked_json').notNull(),
    mlcValid: integer('mlc_valid', { mode: 'boolean' }).notNull().default(true),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    unique('rest_hour_entries_unique_day').on(t.tenantId, t.vesselId, t.crewMemberId, t.date),
    index('rest_hour_entries_tenant_vessel_crew_idx').on(t.tenantId, t.vesselId, t.crewMemberId),
  ],
);

export const crewCertificates = sqliteTable(
  'crew_certificates',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    crewMemberId: text('crew_member_id')
      .notNull()
      .references(() => crewMembers.id),
    certificateType: text('certificate_type').notNull(),
    number: text('number'),
    issuedAt: text('issued_at'),
    expiresAt: text('expires_at'),
    issuedBy: text('issued_by'),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    hlc: text('hlc'),
    deletedAt: text('deleted_at'),
  },
  (t) => [
    index('crew_certificates_tenant_vessel_crew_idx').on(t.tenantId, t.vesselId, t.crewMemberId),
    index('crew_certificates_tenant_expires_idx').on(t.tenantId, t.expiresAt),
  ],
);

// ── Project planning (P3-2) ──────────────────────────────────────────────────

export const PROJECT_STATUSES = [
  'PLANNING',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as const;
export type ProjectTaskStatus = (typeof PROJECT_TASK_STATUSES)[number];

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', { enum: PROJECT_STATUSES }).notNull().default('PLANNING'),
    startDate: text('start_date'),
    endDate: text('end_date'),
    hlc: text('hlc'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('projects_tenant_vessel_status_idx').on(t.tenantId, t.vesselId, t.status)],
);

export const projectTasks = sqliteTable(
  'project_tasks',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    vesselId: text('vessel_id')
      .notNull()
      .references(() => vessels.id),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', { enum: PROJECT_TASK_STATUSES }).notNull().default('TODO'),
    startDate: text('start_date'),
    endDate: text('end_date'),
    plannedDays: integer('planned_days'),
    predecessorId: text('predecessor_id'),
    assignedToRole: text('assigned_to_role'),
    hlc: text('hlc'),
    createdAt: text('created_at').notNull().default(nowIso),
    updatedAt: text('updated_at').notNull().default(nowIso),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('project_tasks_tenant_vessel_project_idx').on(t.tenantId, t.vesselId, t.projectId)],
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
