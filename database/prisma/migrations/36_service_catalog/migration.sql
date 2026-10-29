CREATE TABLE "catalog_items" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "unit_price_cents" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ,
  "deleted_at" TIMESTAMPTZ,
  CONSTRAINT "catalog_items_type_check" CHECK ("type" IN ('PART', 'PRODUCT', 'LABOR')),
  CONSTRAINT "catalog_items_price_check" CHECK ("unit_price_cents" >= 0)
);
CREATE INDEX "catalog_items_tenant_type_name_idx" ON "catalog_items" ("tenant_id", "type", "name") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "catalog_items_tenant_type_name_unique" ON "catalog_items" ("tenant_id", "type", lower("name")) WHERE "deleted_at" IS NULL;
