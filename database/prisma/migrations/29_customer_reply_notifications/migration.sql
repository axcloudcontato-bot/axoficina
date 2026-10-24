CREATE TABLE "customer_reply_reads" (
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "customer_message_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_reply_reads_pkey" PRIMARY KEY ("tenant_id", "user_id", "customer_message_id")
);

CREATE INDEX "customer_messages_tenant_id_answered_at_id_idx"
ON "customer_messages"("tenant_id", "answered_at", "id");
