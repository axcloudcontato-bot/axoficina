ALTER TABLE "tenants"
  ADD COLUMN "smtp_tested_at" TIMESTAMPTZ,
  ADD COLUMN "smtp_test_success_at" TIMESTAMPTZ,
  ADD COLUMN "smtp_test_error" TEXT,
  ADD COLUMN "wa_akg_tested_at" TIMESTAMPTZ,
  ADD COLUMN "wa_akg_test_success_at" TIMESTAMPTZ,
  ADD COLUMN "wa_akg_test_error" TEXT,
  ADD COLUMN "wa_webhook_tested_at" TIMESTAMPTZ,
  ADD COLUMN "wa_webhook_test_success_at" TIMESTAMPTZ,
  ADD COLUMN "wa_webhook_test_error" TEXT;
