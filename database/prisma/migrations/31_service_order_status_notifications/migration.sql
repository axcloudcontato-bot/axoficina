ALTER TABLE "customers" ADD COLUMN "notify_service_order_updates" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "service_order_status_notifications" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "service_order_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "history_id" UUID NOT NULL,
  "from_status" TEXT,
  "to_status" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "failure_reason" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "occurred_at" TIMESTAMPTZ NOT NULL,
  "attempted_at" TIMESTAMPTZ,
  "sent_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_order_status_notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_order_status_notifications_status_check" CHECK ("status" IN ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED'))
);
CREATE UNIQUE INDEX "service_order_status_notifications_history_id_key" ON "service_order_status_notifications"("history_id");
CREATE INDEX "service_order_status_notifications_tenant_id_service_order_id_created_at_idx" ON "service_order_status_notifications"("tenant_id", "service_order_id", "created_at");
CREATE INDEX "service_order_status_notifications_status_created_at_id_idx" ON "service_order_status_notifications"("status", "created_at", "id");
CREATE INDEX "service_order_status_notifications_service_order_id_status_created_at_id_idx" ON "service_order_status_notifications"("service_order_id", "status", "created_at", "id");
