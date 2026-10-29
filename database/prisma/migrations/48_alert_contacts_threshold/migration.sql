-- Every attempt to reach a customer about an alert is kept, so two people do not call the same customer.
CREATE TABLE "maintenance_alert_contacts" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "alert_id" UUID NOT NULL,
  "outcome" TEXT NOT NULL,
  "note" TEXT,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "maintenance_alert_contacts_outcome_check" CHECK ("outcome" IN ('MESSAGE_SENT', 'NO_ANSWER', 'WILL_SCHEDULE', 'NOT_NOW'))
);
CREATE INDEX "maintenance_alert_contacts_alert_idx" ON "maintenance_alert_contacts" ("tenant_id", "alert_id", "created_at" DESC);

-- How many months without a delivered order before a car is flagged: a fleet workshop wants 3, another one 12.
ALTER TABLE "tenants"
  ADD COLUMN "maintenance_alert_months" INTEGER NOT NULL DEFAULT 6,
  ADD CONSTRAINT "tenants_maintenance_alert_months_range" CHECK ("maintenance_alert_months" >= 1 AND "maintenance_alert_months" <= 36);
