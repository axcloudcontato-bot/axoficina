-- Workshop capacity (vehicles served at the same time) and WhatsApp reminders for appointments.
ALTER TABLE "tenants"
  ADD COLUMN "agenda_bays" INTEGER,
  ADD COLUMN "appointment_reminders_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT "tenants_agenda_bays_positive" CHECK ("agenda_bays" IS NULL OR "agenda_bays" BETWEEN 1 AND 100);

ALTER TABLE "appointments"
  ADD COLUMN "reminder_sent_at" TIMESTAMPTZ,
  ADD COLUMN "confirmation_sent_at" TIMESTAMPTZ;

CREATE INDEX "appointments_reminder_due_idx" ON "appointments" ("starts_at") WHERE "reminder_sent_at" IS NULL AND "deleted_at" IS NULL AND "status" IN ('SCHEDULED', 'CONFIRMED');
