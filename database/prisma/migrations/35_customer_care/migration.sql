ALTER TABLE "customers" ADD COLUMN "birth_date" DATE,
  ADD COLUMN "care_messages_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "care_consent_at" TIMESTAMPTZ;
ALTER TABLE "service_order_items" ADD COLUMN "care_service_key" TEXT;

CREATE TABLE "customer_care_settings" (
  "tenant_id" UUID PRIMARY KEY,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
  "time_zone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  "send_hour" INTEGER NOT NULL DEFAULT 9,
  "weekdays_only" BOOLEAN NOT NULL DEFAULT true,
  "min_gap_days" INTEGER NOT NULL DEFAULT 7,
  "daily_limit" INTEGER NOT NULL DEFAULT 50,
  "campaigns" JSONB NOT NULL,
  "updated_by" UUID,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE "customer_care_plans" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "vehicle_id" UUID NOT NULL,
  "service_key" TEXT NOT NULL,
  "completed_at" TIMESTAMPTZ NOT NULL,
  "mileage" INTEGER,
  "interval_months" INTEGER,
  "interval_km" INTEGER,
  "source_order_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "care_plans_tenant_vehicle_service_key" ON "customer_care_plans" ("tenant_id", "vehicle_id", "service_key");
CREATE INDEX "care_plans_tenant_customer_idx" ON "customer_care_plans" ("tenant_id", "customer_id");
CREATE TABLE "customer_care_deliveries" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "customer_name" TEXT NOT NULL,
  "campaign_keys" TEXT[] NOT NULL,
  "event_keys" TEXT[] NOT NULL,
  "events" JSONB NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "unsubscribe_hash" TEXT NOT NULL,
  "unsubscribe_token" TEXT NOT NULL,
  "scheduled_at" TIMESTAMPTZ NOT NULL,
  "attempted_at" TIMESTAMPTZ,
  "sent_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "care_deliveries_tenant_dedupe_key" ON "customer_care_deliveries" ("tenant_id", "dedupe_key");
CREATE UNIQUE INDEX "customer_care_deliveries_unsubscribe_hash_key" ON "customer_care_deliveries" ("unsubscribe_hash");
CREATE INDEX "care_deliveries_tenant_customer_idx" ON "customer_care_deliveries" ("tenant_id", "customer_id", "created_at");
CREATE INDEX "care_deliveries_status_scheduled_idx" ON "customer_care_deliveries" ("status", "scheduled_at");
CREATE INDEX "care_deliveries_events_idx" ON "customer_care_deliveries" USING GIN ("event_keys");
