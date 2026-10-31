-- First-access setup: a new workshop is taken through a guided company setup before using the system.
-- Workshops that already exist are marked as done, so nobody is sent back to a setup they never needed.
ALTER TABLE "tenants" ADD COLUMN "onboarding_completed_at" TIMESTAMPTZ;
UPDATE "tenants" SET "onboarding_completed_at" = NOW();
