CREATE TABLE "customer_messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenant_id" UUID NOT NULL,
    "service_order_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[] NOT NULL,
    "message" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "selected_option" INTEGER,
    "answered_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_messages_channel_check" CHECK ("channel" IN ('EMAIL', 'WHATSAPP')),
    CONSTRAINT "customer_messages_options_check" CHECK (cardinality("options") BETWEEN 2 AND 3),
    CONSTRAINT "customer_messages_answer_check" CHECK (
      ("selected_option" IS NULL AND "answered_at" IS NULL) OR
      ("selected_option" IS NOT NULL AND "answered_at" IS NOT NULL AND "selected_option" >= 0 AND "selected_option" < cardinality("options"))
    )
);
CREATE UNIQUE INDEX "customer_messages_token_hash_key" ON "customer_messages"("token_hash");
CREATE INDEX "customer_messages_tenant_id_service_order_id_created_at_idx" ON "customer_messages"("tenant_id", "service_order_id", "created_at");
CREATE INDEX "customer_messages_tenant_id_customer_id_idx" ON "customer_messages"("tenant_id", "customer_id");
