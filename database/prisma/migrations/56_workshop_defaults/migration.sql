-- Defaults every new order starts with, what goes printed on quotes and orders, and the payment methods offered.
ALTER TABLE "tenants"
  ADD COLUMN "default_warranty_days" INTEGER,
  ADD COLUMN "quote_validity_days" INTEGER,
  ADD COLUMN "document_terms" TEXT,
  ADD COLUMN "accepted_payment_methods" TEXT[] NOT NULL DEFAULT '{}',
  -- Hours of a specific weekday ({"6": {"openHour": 8, "closeHour": 12}}) and dates the workshop is closed (holidays).
  ADD COLUMN "agenda_day_hours" JSONB,
  ADD COLUMN "agenda_closed_dates" TEXT[] NOT NULL DEFAULT '{}';

-- When each person last signed in, so the team list shows who never used their access or left long ago.
ALTER TABLE "users" ADD COLUMN "last_login_at" TIMESTAMPTZ;
