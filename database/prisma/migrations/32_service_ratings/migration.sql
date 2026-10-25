ALTER TABLE "service_order_status_notifications"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'STATUS',
  ADD COLUMN "customer_message_id" UUID,
  ADD COLUMN "response_token" TEXT;
DROP INDEX "service_order_status_notifications_history_id_key";
CREATE UNIQUE INDEX "service_order_notices_history_kind_key" ON "service_order_status_notifications"("history_id", "kind");
ALTER TABLE "service_order_status_notifications" ADD CONSTRAINT "service_order_notices_kind_check" CHECK ("kind" IN ('STATUS', 'RATING'));
