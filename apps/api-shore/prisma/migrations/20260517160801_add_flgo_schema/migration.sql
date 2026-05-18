-- CreateEnum
CREATE TYPE "TankType" AS ENUM ('HFO', 'LSFO', 'MDO', 'MGO', 'LSMGO', 'LNG', 'ULSFO', 'FRESH_WATER', 'BALLAST', 'OTHER');

-- CreateEnum
CREATE TYPE "ConsumerType" AS ENUM ('MAIN_ENGINE', 'AUX_ENGINE', 'BOILER', 'OTHER');

-- CreateTable
CREATE TABLE "fuel_products" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tank_type" "TankType" NOT NULL,
    "sulphur_pct" DECIMAL(5,4),
    "density_kg_m3" DECIMAL(8,3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fuel_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tanks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tank_type" "TankType" NOT NULL,
    "fuel_product_id" TEXT,
    "capacity_m3" DECIMAL(10,3),
    "frame_position" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tanks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tank_readings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "tank_id" TEXT NOT NULL,
    "reading_date" TEXT NOT NULL,
    "rob_mt" DECIMAL(10,3) NOT NULL,
    "rob_m3" DECIMAL(10,3),
    "trim" DECIMAL(5,2),
    "notes" TEXT,
    "recorded_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tank_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bunker_delivery_notes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "fuel_product_id" TEXT,
    "bdn_number" TEXT,
    "delivery_date" TEXT NOT NULL,
    "port" TEXT,
    "supplier_name" TEXT,
    "quantity_mt" DECIMAL(10,3) NOT NULL,
    "density_kg_m3" DECIMAL(8,3),
    "sulphur_pct" DECIMAL(5,4),
    "grade" TEXT,
    "viscosity" DECIMAL(8,3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bunker_delivery_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumption_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "fuel_product_id" TEXT,
    "log_date" TEXT NOT NULL,
    "consumer_type" "ConsumerType" NOT NULL,
    "consumer_name" TEXT,
    "consumption_mt" DECIMAL(10,3) NOT NULL,
    "voyage_leg" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hlc" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "consumption_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fuel_products_tenant_id_idx" ON "fuel_products"("tenant_id");

-- CreateIndex
CREATE INDEX "tanks_tenant_id_vessel_id_idx" ON "tanks"("tenant_id", "vessel_id");

-- CreateIndex
CREATE INDEX "tank_readings_tenant_id_vessel_id_reading_date_idx" ON "tank_readings"("tenant_id", "vessel_id", "reading_date");

-- CreateIndex
CREATE UNIQUE INDEX "tank_readings_tenant_id_vessel_id_tank_id_reading_date_key" ON "tank_readings"("tenant_id", "vessel_id", "tank_id", "reading_date");

-- CreateIndex
CREATE INDEX "bunker_delivery_notes_tenant_id_vessel_id_delivery_date_idx" ON "bunker_delivery_notes"("tenant_id", "vessel_id", "delivery_date");

-- CreateIndex
CREATE INDEX "consumption_logs_tenant_id_vessel_id_log_date_idx" ON "consumption_logs"("tenant_id", "vessel_id", "log_date");

-- CreateIndex
CREATE INDEX "consumption_logs_tenant_id_vessel_id_consumer_type_idx" ON "consumption_logs"("tenant_id", "vessel_id", "consumer_type");

-- AddForeignKey
ALTER TABLE "fuel_products" ADD CONSTRAINT "fuel_products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tanks" ADD CONSTRAINT "tanks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tanks" ADD CONSTRAINT "tanks_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tanks" ADD CONSTRAINT "tanks_fuel_product_id_fkey" FOREIGN KEY ("fuel_product_id") REFERENCES "fuel_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tank_readings" ADD CONSTRAINT "tank_readings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tank_readings" ADD CONSTRAINT "tank_readings_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tank_readings" ADD CONSTRAINT "tank_readings_tank_id_fkey" FOREIGN KEY ("tank_id") REFERENCES "tanks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bunker_delivery_notes" ADD CONSTRAINT "bunker_delivery_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bunker_delivery_notes" ADD CONSTRAINT "bunker_delivery_notes_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bunker_delivery_notes" ADD CONSTRAINT "bunker_delivery_notes_fuel_product_id_fkey" FOREIGN KEY ("fuel_product_id") REFERENCES "fuel_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_logs" ADD CONSTRAINT "consumption_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_logs" ADD CONSTRAINT "consumption_logs_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption_logs" ADD CONSTRAINT "consumption_logs_fuel_product_id_fkey" FOREIGN KEY ("fuel_product_id") REFERENCES "fuel_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: tenant isolation on all FLGO tables
ALTER TABLE "fuel_products"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tanks"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tank_readings"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bunker_delivery_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consumption_logs"    ENABLE ROW LEVEL SECURITY;

CREATE POLICY fuel_products_tenant_isolation       ON "fuel_products"         USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY tanks_tenant_isolation               ON "tanks"                 USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY tank_readings_tenant_isolation       ON "tank_readings"         USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY bunker_delivery_notes_tenant_isolation ON "bunker_delivery_notes" USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY consumption_logs_tenant_isolation    ON "consumption_logs"      USING (tenant_id = current_setting('app.tenant_id', true));
