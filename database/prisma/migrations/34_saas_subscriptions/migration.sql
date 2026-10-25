ALTER TABLE "tenants"
  ADD COLUMN "subscription_status" TEXT NOT NULL DEFAULT 'unconfigured',
  ADD COLUMN "subscription_amount_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "subscription_cycle" TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN "subscription_due_at" TIMESTAMPTZ,
  ADD COLUMN "subscription_notes" TEXT;

ALTER TABLE "tenants"
  ADD CONSTRAINT "tenants_subscription_status_check" CHECK ("subscription_status" IN ('unconfigured', 'trial', 'active', 'past_due', 'canceled')),
  ADD CONSTRAINT "tenants_subscription_amount_check" CHECK ("subscription_amount_cents" >= 0),
  ADD CONSTRAINT "tenants_subscription_cycle_check" CHECK ("subscription_cycle" IN ('monthly', 'yearly'));
