-- Catalog management: cost, identification, supplier, standard time and the care a service schedules.
ALTER TABLE "catalog_items"
  ADD COLUMN "cost_cents" INTEGER,
  ADD COLUMN "code" TEXT,
  ADD COLUMN "brand" TEXT,
  ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'un',
  ADD COLUMN "supplier_id" UUID,
  ADD COLUMN "standard_minutes" INTEGER,
  ADD COLUMN "care_service_key" TEXT,
  ADD CONSTRAINT "catalog_items_cost_nonnegative" CHECK ("cost_cents" IS NULL OR "cost_cents" >= 0),
  ADD CONSTRAINT "catalog_items_minutes_range" CHECK ("standard_minutes" IS NULL OR ("standard_minutes" >= 1 AND "standard_minutes" <= 1440));

-- An order item remembers where it came from and what the item cost at that moment,
-- so margin reports keep working after the catalog changes.
ALTER TABLE "service_order_items"
  ADD COLUMN "catalog_item_id" UUID,
  ADD COLUMN "cost_cents" INTEGER,
  ADD CONSTRAINT "service_order_items_cost_nonnegative" CHECK ("cost_cents" IS NULL OR "cost_cents" >= 0);

ALTER TABLE "tenants"
  ADD COLUMN "labor_rate_cents" INTEGER,
  ADD CONSTRAINT "tenants_labor_rate_nonnegative" CHECK ("labor_rate_cents" IS NULL OR "labor_rate_cents" >= 0);

-- Workshops that already loaded the default catalog get the care mapping on its services.
UPDATE "catalog_items" SET "care_service_key" = 'PERIODIC_REVIEW' WHERE "type" = 'LABOR' AND "name" = 'Revisão preventiva' AND "care_service_key" IS NULL AND "deleted_at" IS NULL;
UPDATE "catalog_items" SET "care_service_key" = 'OIL_CHANGE' WHERE "type" = 'LABOR' AND "name" = 'Troca de óleo e filtro' AND "care_service_key" IS NULL AND "deleted_at" IS NULL;
UPDATE "catalog_items" SET "care_service_key" = 'AIR_FILTER' WHERE "type" = 'LABOR' AND "name" = 'Troca de filtro de ar' AND "care_service_key" IS NULL AND "deleted_at" IS NULL;
UPDATE "catalog_items" SET "care_service_key" = 'CABIN_FILTER' WHERE "type" = 'LABOR' AND "name" = 'Troca de filtro de cabine (ar-condicionado)' AND "care_service_key" IS NULL AND "deleted_at" IS NULL;
UPDATE "catalog_items" SET "care_service_key" = 'SPARK_PLUGS' WHERE "type" = 'LABOR' AND "name" = 'Troca de velas de ignição' AND "care_service_key" IS NULL AND "deleted_at" IS NULL;
UPDATE "catalog_items" SET "care_service_key" = 'BELTS' WHERE "type" = 'LABOR' AND "name" = 'Troca de correia dentada' AND "care_service_key" IS NULL AND "deleted_at" IS NULL;
UPDATE "catalog_items" SET "care_service_key" = 'BELTS' WHERE "type" = 'LABOR' AND "name" = 'Troca de correia do alternador' AND "care_service_key" IS NULL AND "deleted_at" IS NULL;
UPDATE "catalog_items" SET "care_service_key" = 'BRAKES' WHERE "type" = 'LABOR' AND "name" = 'Troca de pastilhas de freio' AND "care_service_key" IS NULL AND "deleted_at" IS NULL;
UPDATE "catalog_items" SET "care_service_key" = 'BRAKES' WHERE "type" = 'LABOR' AND "name" = 'Troca de discos de freio' AND "care_service_key" IS NULL AND "deleted_at" IS NULL;
UPDATE "catalog_items" SET "care_service_key" = 'BRAKES' WHERE "type" = 'LABOR' AND "name" = 'Revisão do sistema de freios' AND "care_service_key" IS NULL AND "deleted_at" IS NULL;
UPDATE "catalog_items" SET "care_service_key" = 'BRAKE_FLUID' WHERE "type" = 'LABOR' AND "name" = 'Sangria do sistema de freio' AND "care_service_key" IS NULL AND "deleted_at" IS NULL;
UPDATE "catalog_items" SET "care_service_key" = 'BATTERY' WHERE "type" = 'LABOR' AND "name" = 'Troca de bateria' AND "care_service_key" IS NULL AND "deleted_at" IS NULL;
UPDATE "catalog_items" SET "care_service_key" = 'TIRES' WHERE "type" = 'LABOR' AND "name" = 'Troca de pneus' AND "care_service_key" IS NULL AND "deleted_at" IS NULL;
UPDATE "catalog_items" SET "care_service_key" = 'TIRES' WHERE "type" = 'LABOR' AND "name" = 'Rodízio de pneus' AND "care_service_key" IS NULL AND "deleted_at" IS NULL;
UPDATE "catalog_items" SET "care_service_key" = 'TIRES' WHERE "type" = 'LABOR' AND "name" = 'Alinhamento de direção' AND "care_service_key" IS NULL AND "deleted_at" IS NULL;
UPDATE "catalog_items" SET "care_service_key" = 'TIRES' WHERE "type" = 'LABOR' AND "name" = 'Balanceamento de rodas' AND "care_service_key" IS NULL AND "deleted_at" IS NULL;
