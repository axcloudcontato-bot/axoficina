-- Closing a workshop: access ends at once (tenants.deleted_at), the data waits purge_after (30 days) so it can be restored,
-- and after that it is erased. account_closures keeps only the bare facts of an erased workshop, with no personal data.
ALTER TABLE "tenants"
  ADD COLUMN "closure_reason" TEXT,
  ADD COLUMN "closed_by" TEXT,
  ADD COLUMN "purge_after" TIMESTAMPTZ;
CREATE INDEX "tenants_purge_after_idx" ON "tenants" ("purge_after") WHERE "deleted_at" IS NOT NULL;

CREATE TABLE "account_closures" (
  "tenant_id" UUID PRIMARY KEY,
  "closed_by" TEXT NOT NULL,
  "closed_at" TIMESTAMPTZ NOT NULL,
  "purged_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
