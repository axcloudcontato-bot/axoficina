ALTER TABLE "tenants"
  ADD COLUMN "wa_akg_base_url" TEXT,
  ADD COLUMN "wa_akg_session_id" TEXT,
  ADD COLUMN "wa_akg_api_key" TEXT,
  ADD COLUMN "wa_akg_webhook_secret" TEXT,
  ADD COLUMN "wa_akg_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "customer_messages"
  ADD COLUMN "delivery_mode" TEXT NOT NULL DEFAULT 'LINK',
  ADD COLUMN "sent_at" TIMESTAMPTZ,
  ADD COLUMN "whatsapp_session_id" TEXT,
  ADD COLUMN "whatsapp_recipient" TEXT,
  ADD COLUMN "provider_message_id" TEXT,
  ADD CONSTRAINT "customer_messages_delivery_mode_check" CHECK ("delivery_mode" IN ('LINK', 'WA_AKG'));
