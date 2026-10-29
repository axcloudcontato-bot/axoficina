-- Which photo evidence a workshop requires before an order advances.
-- Defaults keep today's behaviour: everything is required.
ALTER TABLE "tenants"
  ADD COLUMN "photo_require_entry" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "photo_require_exit" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "photo_require_items" BOOLEAN NOT NULL DEFAULT true;
