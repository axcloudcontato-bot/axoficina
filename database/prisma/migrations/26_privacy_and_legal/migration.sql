ALTER TABLE "users" ADD COLUMN "legal_version" TEXT;
ALTER TABLE "users" ADD COLUMN "legal_accepted_at" TIMESTAMPTZ;

-- Mantém compatibilidade com respostas existentes: ausência de documento = ''.
-- Clientes sem documento não devem disputar unicidade.
DROP INDEX "idx_customers_tenant_document_active";
CREATE UNIQUE INDEX "idx_customers_tenant_document_active"
  ON "customers"("tenant_id", "document")
  WHERE "deleted_at" IS NULL AND "document" <> '';

CREATE TABLE "privacy_requests" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "customer_id" UUID,
  "type" TEXT NOT NULL CHECK ("type" IN ('ACCESS', 'CORRECTION', 'PORTABILITY', 'RESTRICTION', 'DELETION', 'REFUND', 'CANCELLATION')),
  "status" TEXT NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN', 'IN_REVIEW', 'COMPLETED', 'RETAINED')),
  "details" TEXT,
  "response" TEXT,
  "resolved_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "due_at" TIMESTAMPTZ NOT NULL,
  "resolved_at" TIMESTAMPTZ,
  "retention_until" TIMESTAMPTZ,
  CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "privacy_requests_tenant_id_user_id_created_at_idx" ON "privacy_requests"("tenant_id", "user_id", "created_at");
CREATE INDEX "privacy_requests_tenant_id_status_due_at_idx" ON "privacy_requests"("tenant_id", "status", "due_at");
