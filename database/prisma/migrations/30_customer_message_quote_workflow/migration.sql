ALTER TABLE "customer_messages"
  ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'CUSTOM',
  ADD COLUMN "quote_snapshot" JSONB;

ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_purpose_check"
  CHECK ("purpose" IN ('QUOTE', 'SCHEDULE', 'PICKUP', 'CUSTOM'));
