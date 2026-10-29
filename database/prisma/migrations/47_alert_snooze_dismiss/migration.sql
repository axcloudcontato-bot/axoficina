-- An alert can be postponed (it comes back by itself) or dismissed with a reason (it leaves the list and says why).
ALTER TABLE "maintenance_alerts"
  ADD COLUMN "snoozed_until" TIMESTAMPTZ,
  ADD COLUMN "dismiss_reason" TEXT,
  ADD COLUMN "dismiss_note" TEXT,
  ADD CONSTRAINT "maintenance_alerts_dismiss_reason_check" CHECK ("dismiss_reason" IS NULL OR "dismiss_reason" IN ('SOLD', 'MOVED', 'NO_CONTACT', 'OTHER'));
