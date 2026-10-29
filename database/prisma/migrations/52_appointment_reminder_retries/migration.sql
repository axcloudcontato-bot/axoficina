ALTER TABLE "appointments"
  ADD COLUMN "reminder_claimed_at" TIMESTAMPTZ,
  ADD COLUMN "reminder_attempted_at" TIMESTAMPTZ,
  ADD COLUMN "reminder_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reminder_last_error" TEXT;

CREATE INDEX "appointments_reminder_retry_idx" ON "appointments" ("tenant_id", "starts_at", "reminder_attempted_at")
  WHERE "reminder_sent_at" IS NULL AND "deleted_at" IS NULL AND "status" IN ('SCHEDULED', 'CONFIRMED');
