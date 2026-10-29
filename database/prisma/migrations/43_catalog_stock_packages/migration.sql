-- Stock control for parts and products, and service packages.
ALTER TABLE "catalog_items"
  ADD COLUMN "track_stock" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stock_quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "min_stock" DECIMAL(10,2),
  ADD CONSTRAINT "catalog_items_min_stock_nonnegative" CHECK ("min_stock" IS NULL OR "min_stock" >= 0);

-- Every change of the balance leaves a trace. A sale is written once per order and item,
-- so delivering the same order twice can never take the stock down twice.
CREATE TABLE "stock_movements" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "catalog_item_id" UUID NOT NULL,
  "service_order_id" UUID,
  "kind" TEXT NOT NULL,
  "quantity" DECIMAL(10,2) NOT NULL,
  "balance_after" DECIMAL(10,2) NOT NULL,
  "note" TEXT,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "stock_movements_kind_check" CHECK ("kind" IN ('SALE', 'PURCHASE', 'ADJUSTMENT'))
);
CREATE INDEX "stock_movements_item_idx" ON "stock_movements" ("tenant_id", "catalog_item_id", "created_at" DESC);
CREATE UNIQUE INDEX "stock_movements_sale_unique" ON "stock_movements" ("service_order_id", "catalog_item_id") WHERE "kind" = 'SALE';

CREATE TABLE "catalog_packages" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ,
  "deleted_at" TIMESTAMPTZ
);
CREATE UNIQUE INDEX "catalog_packages_tenant_name_unique" ON "catalog_packages" ("tenant_id", lower("name")) WHERE "deleted_at" IS NULL;

CREATE TABLE "catalog_package_items" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "package_id" UUID NOT NULL REFERENCES "catalog_packages" ("id") ON DELETE CASCADE,
  "catalog_item_id" UUID NOT NULL,
  "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
  CONSTRAINT "catalog_package_items_quantity_check" CHECK ("quantity" > 0)
);
CREATE INDEX "catalog_package_items_package_idx" ON "catalog_package_items" ("package_id");
