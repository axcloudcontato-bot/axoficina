-- Existing vehicles need human review; their type cannot be inferred from brand or model safely.
ALTER TABLE "vehicles" ADD COLUMN "category" TEXT;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_category_check" CHECK ("category" IN ('CAR', 'MOTORCYCLE', 'TRUCK'));
CREATE INDEX "vehicles_tenant_id_category_idx" ON "vehicles" ("tenant_id", "category");
