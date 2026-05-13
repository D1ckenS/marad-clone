-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('CONSUMPTION', 'RECEIPT', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateTable
CREATE TABLE "part_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "part_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "part_number" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_locations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_levels" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "min_stock" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "max_stock" DECIMAL(14,4),
    "reorder_point" DECIMAL(14,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "movement_type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "notes" TEXT,
    "recorded_by_user_id" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barcode_bindings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "barcode_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "part_categories_tenant_id_idx" ON "part_categories"("tenant_id");

-- CreateIndex
CREATE INDEX "parts_tenant_id_idx" ON "parts"("tenant_id");

-- CreateIndex
CREATE INDEX "parts_tenant_id_part_number_idx" ON "parts"("tenant_id", "part_number");

-- CreateIndex
CREATE INDEX "stock_locations_tenant_id_vessel_id_idx" ON "stock_locations"("tenant_id", "vessel_id");

-- CreateIndex
CREATE INDEX "stock_levels_tenant_id_vessel_id_idx" ON "stock_levels"("tenant_id", "vessel_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_levels_tenant_id_vessel_id_part_id_location_id_key" ON "stock_levels"("tenant_id", "vessel_id", "part_id", "location_id");

-- CreateIndex
CREATE INDEX "stock_movements_tenant_id_vessel_id_part_id_location_id_rec_idx" ON "stock_movements"("tenant_id", "vessel_id", "part_id", "location_id", "recorded_at");

-- CreateIndex
CREATE INDEX "stock_movements_tenant_id_vessel_id_movement_type_recorded__idx" ON "stock_movements"("tenant_id", "vessel_id", "movement_type", "recorded_at");

-- CreateIndex
CREATE INDEX "barcode_bindings_tenant_id_part_id_idx" ON "barcode_bindings"("tenant_id", "part_id");

-- CreateIndex
CREATE UNIQUE INDEX "barcode_bindings_tenant_id_barcode_key" ON "barcode_bindings"("tenant_id", "barcode");

-- AddForeignKey
ALTER TABLE "part_categories" ADD CONSTRAINT "part_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_categories" ADD CONSTRAINT "part_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "part_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "part_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barcode_bindings" ADD CONSTRAINT "barcode_bindings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barcode_bindings" ADD CONSTRAINT "barcode_bindings_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── RLS — tenant isolation on every new inventory table ─────────────────────
-- Same policy shape as maintenance tables (migration 20260506173034).

ALTER TABLE "part_categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "part_categories_tenant_isolation" ON "part_categories"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "parts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parts_tenant_isolation" ON "parts"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "stock_locations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_locations_tenant_isolation" ON "stock_locations"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "stock_levels" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_levels_tenant_isolation" ON "stock_levels"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_movements_tenant_isolation" ON "stock_movements"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );

ALTER TABLE "barcode_bindings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "barcode_bindings_tenant_isolation" ON "barcode_bindings"
  USING (
    current_setting('app.current_tenant_id', true) = '' OR
    tenant_id = current_setting('app.current_tenant_id', true)
  );
