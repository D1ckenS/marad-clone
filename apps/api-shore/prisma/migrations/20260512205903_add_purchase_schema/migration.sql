-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'ACKNOWLEDGED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('DRAFT', 'SENT', 'CLOSED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "address" TEXT,
    "country" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_flows" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "approval_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "flow_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "approver_role" "Role" NOT NULL,
    "limit_amount" DECIMAL(14,2),
    "limit_currency" TEXT NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisitions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "RequisitionStatus" NOT NULL DEFAULT 'DRAFT',
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "requested_by_user_id" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL,
    "approval_flow_id" TEXT,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_by_user_id" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisition_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "part_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "estimated_unit_price" DECIMAL(14,2),
    "estimated_total_price" DECIMAL(14,2),
    "currency" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "requisition_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfqs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "requisition_id" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "RfqStatus" NOT NULL DEFAULT 'DRAFT',
    "issued_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "rfq_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "valid_until" TIMESTAMP(3),
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "part_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "unit_price" DECIMAL(14,2) NOT NULL,
    "total_price" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "quote_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "requisition_id" TEXT,
    "rfq_id" TEXT,
    "supplier_id" TEXT,
    "po_number" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "ordered_by_user_id" TEXT,
    "ordered_at" TIMESTAMP(3),
    "expected_delivery_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "part_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "unit_price" DECIMAL(14,2) NOT NULL,
    "total_price" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "requisition_line_id" TEXT,
    "quote_line_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "po_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "received_by_user_id" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "po_line_id" TEXT NOT NULL,
    "part_id" TEXT,
    "description" TEXT,
    "quantity_ordered" DECIMAL(14,4) NOT NULL,
    "quantity_received" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_idx" ON "suppliers"("tenant_id");

-- CreateIndex
CREATE INDEX "approval_flows_tenant_id_idx" ON "approval_flows"("tenant_id");

-- CreateIndex
CREATE INDEX "approval_steps_tenant_id_idx" ON "approval_steps"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_steps_flow_id_step_order_key" ON "approval_steps"("flow_id", "step_order");

-- CreateIndex
CREATE INDEX "requisitions_tenant_id_vessel_id_status_idx" ON "requisitions"("tenant_id", "vessel_id", "status");

-- CreateIndex
CREATE INDEX "requisitions_tenant_id_vessel_id_requested_at_idx" ON "requisitions"("tenant_id", "vessel_id", "requested_at");

-- CreateIndex
CREATE INDEX "requisition_lines_tenant_id_vessel_id_requisition_id_idx" ON "requisition_lines"("tenant_id", "vessel_id", "requisition_id");

-- CreateIndex
CREATE INDEX "rfqs_tenant_id_vessel_id_status_idx" ON "rfqs"("tenant_id", "vessel_id", "status");

-- CreateIndex
CREATE INDEX "quotes_tenant_id_vessel_id_rfq_id_idx" ON "quotes"("tenant_id", "vessel_id", "rfq_id");

-- CreateIndex
CREATE INDEX "quote_lines_tenant_id_vessel_id_quote_id_idx" ON "quote_lines"("tenant_id", "vessel_id", "quote_id");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_vessel_id_status_idx" ON "purchase_orders"("tenant_id", "vessel_id", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_vessel_id_supplier_id_idx" ON "purchase_orders"("tenant_id", "vessel_id", "supplier_id");

-- CreateIndex
CREATE INDEX "po_lines_tenant_id_vessel_id_po_id_idx" ON "po_lines"("tenant_id", "vessel_id", "po_id");

-- CreateIndex
CREATE INDEX "goods_receipts_tenant_id_vessel_id_po_id_idx" ON "goods_receipts"("tenant_id", "vessel_id", "po_id");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_tenant_id_vessel_id_receipt_id_idx" ON "goods_receipt_lines"("tenant_id", "vessel_id", "receipt_id");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_tenant_id_vessel_id_po_line_id_idx" ON "goods_receipt_lines"("tenant_id", "vessel_id", "po_line_id");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_flows" ADD CONSTRAINT "approval_flows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "approval_flows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_approval_flow_id_fkey" FOREIGN KEY ("approval_flow_id") REFERENCES "approval_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisition_lines" ADD CONSTRAINT "requisition_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisition_lines" ADD CONSTRAINT "requisition_lines_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisition_lines" ADD CONSTRAINT "requisition_lines_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisition_lines" ADD CONSTRAINT "requisition_lines_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_requisition_line_id_fkey" FOREIGN KEY ("requisition_line_id") REFERENCES "requisition_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_po_line_id_fkey" FOREIGN KEY ("po_line_id") REFERENCES "po_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── CHECK constraints ────────────────────────────────────────────────────────
-- Requisitions: status APPROVED requires an approver.
ALTER TABLE "requisitions"
  ADD CONSTRAINT "requisitions_approved_requires_approver_chk"
  CHECK (status != 'APPROVED' OR approved_by_user_id IS NOT NULL);

-- PurchaseOrders: supplier must be set before leaving DRAFT.
ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_non_draft_requires_supplier_chk"
  CHECK (status = 'DRAFT' OR supplier_id IS NOT NULL);

-- ── RLS — tenant isolation on every new purchase table ───────────────────────

ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_tenant_isolation" ON "suppliers"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "approval_flows" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approval_flows_tenant_isolation" ON "approval_flows"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "approval_steps" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approval_steps_tenant_isolation" ON "approval_steps"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "requisitions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requisitions_tenant_isolation" ON "requisitions"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "requisition_lines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requisition_lines_tenant_isolation" ON "requisition_lines"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "rfqs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rfqs_tenant_isolation" ON "rfqs"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotes_tenant_isolation" ON "quotes"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "quote_lines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quote_lines_tenant_isolation" ON "quote_lines"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "purchase_orders" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_orders_tenant_isolation" ON "purchase_orders"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "po_lines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_lines_tenant_isolation" ON "po_lines"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "goods_receipts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goods_receipts_tenant_isolation" ON "goods_receipts"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "goods_receipt_lines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goods_receipt_lines_tenant_isolation" ON "goods_receipt_lines"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );
