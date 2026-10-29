-- Calls and manual messages to customers who did not authorize the automatic reminders, per care plan,
-- so two people do not reach the same customer about the same care.
CREATE TABLE "customer_care_contacts" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "outcome" TEXT NOT NULL,
  "note" TEXT,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "customer_care_contacts_outcome_check" CHECK ("outcome" IN ('MESSAGE_SENT', 'NO_ANSWER', 'WILL_SCHEDULE', 'NOT_NOW'))
);
CREATE INDEX "customer_care_contacts_plan_idx" ON "customer_care_contacts" ("tenant_id", "plan_id", "created_at" DESC);
