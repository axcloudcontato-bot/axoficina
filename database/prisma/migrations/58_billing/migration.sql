-- Automatic billing (Stripe): the workshop's customer and subscription at the payment provider, a plan change waiting for the next payment,
-- and a copy of each charge so invoices can be listed without asking the provider.
ALTER TABLE "tenants"
  ADD COLUMN "billing_customer_id" TEXT,
  ADD COLUMN "billing_subscription_id" TEXT,
  ADD COLUMN "pending_plan" TEXT;
CREATE INDEX "tenants_billing_subscription_idx" ON "tenants" ("billing_subscription_id");

CREATE TABLE "billing_invoices" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "provider_payment_id" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "due_date" DATE NOT NULL,
  "status" TEXT NOT NULL,
  "paid_at" TIMESTAMPTZ,
  "invoice_url" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "billing_invoices_status_check" CHECK ("status" IN ('pending', 'paid', 'overdue', 'canceled', 'refunded'))
);
CREATE UNIQUE INDEX "billing_invoices_provider_payment_key" ON "billing_invoices" ("provider_payment_id");
CREATE INDEX "billing_invoices_tenant_due_idx" ON "billing_invoices" ("tenant_id", "due_date" DESC);
