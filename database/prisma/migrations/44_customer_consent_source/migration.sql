-- Who recorded the customer's consent to care messages, and how the customer gave it.
ALTER TABLE "customers"
  ADD COLUMN "care_consent_source" TEXT,
  ADD COLUMN "care_consent_by" UUID,
  ADD CONSTRAINT "customers_care_consent_source_check" CHECK ("care_consent_source" IS NULL OR "care_consent_source" IN ('COUNTER', 'PHONE', 'WHATSAPP', 'SITE', 'OTHER'));
