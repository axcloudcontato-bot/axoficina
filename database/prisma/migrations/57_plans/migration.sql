-- Plans: essencial, profissional or completo, plus modules sold on top of the plan.
-- Workshops that exist today keep everything ("completo") until the owner of the SaaS picks a plan for them.
ALTER TABLE "tenants" ADD COLUMN "extra_modules" TEXT[] NOT NULL DEFAULT '{}';
UPDATE "tenants" SET "plan" = 'completo' WHERE "plan" NOT IN ('essencial', 'profissional', 'completo');
ALTER TABLE "tenants" ALTER COLUMN "plan" SET DEFAULT 'completo';
