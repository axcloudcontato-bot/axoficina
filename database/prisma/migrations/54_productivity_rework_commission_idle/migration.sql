-- An order that came back under the warranty of an earlier one: the earlier order's technicians get the rework.
CREATE TABLE "service_order_warranty_returns" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "service_order_id" UUID NOT NULL,
  "original_order_id" UUID NOT NULL,
  "reason" TEXT,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "service_order_warranty_returns_distinct_check" CHECK ("service_order_id" <> "original_order_id")
);
CREATE UNIQUE INDEX "service_order_warranty_returns_order_key" ON "service_order_warranty_returns" ("tenant_id", "service_order_id");
CREATE INDEX "service_order_warranty_returns_period_idx" ON "service_order_warranty_returns" ("tenant_id", "created_at");

-- Commission per technician: a percentage of the labor, plus a bonus percentage when the month's labor target is reached.
-- Basis points: 1000 = 10%.
CREATE TABLE "technician_commission_rules" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "technician_id" UUID NOT NULL,
  "labor_percent_bp" INTEGER NOT NULL,
  "bonus_percent_bp" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "technician_commission_rules_percent_check" CHECK ("labor_percent_bp" BETWEEN 0 AND 10000 AND "bonus_percent_bp" BETWEEN 0 AND 10000)
);
CREATE UNIQUE INDEX "technician_commission_rules_technician_key" ON "technician_commission_rules" ("tenant_id", "technician_id");

-- Time a technician spends at work but not on an order: waiting for parts, cleaning, errands, training.
CREATE TABLE "technician_idle_sessions" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "technician_id" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "note" TEXT,
  "started_at" TIMESTAMPTZ NOT NULL,
  "ended_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "technician_idle_sessions_reason_check" CHECK ("reason" IN ('WAITING_PARTS', 'CLEANING', 'ERRANDS', 'TRAINING', 'OTHER'))
);
CREATE INDEX "technician_idle_sessions_period_idx" ON "technician_idle_sessions" ("tenant_id", "technician_id", "started_at");
CREATE UNIQUE INDEX "technician_idle_sessions_one_open_key" ON "technician_idle_sessions" ("tenant_id", "technician_id") WHERE "ended_at" IS NULL;
