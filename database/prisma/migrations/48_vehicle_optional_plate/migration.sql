ALTER TABLE "vehicles" ALTER COLUMN "plate" DROP NOT NULL;
CREATE UNIQUE INDEX "idx_vehicles_tenant_chassis_unplated_active" ON "vehicles" ("tenant_id", "chassis")
WHERE "deleted_at" IS NULL AND "plate" IS NULL AND "chassis" IS NOT NULL;
