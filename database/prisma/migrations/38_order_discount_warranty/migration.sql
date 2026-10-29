-- Order-level discount, warranty promised at delivery and the odometer reading at pickup.
ALTER TABLE "service_orders"
  ADD COLUMN "discount_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "warranty_days" INTEGER,
  ADD COLUMN "exit_mileage" INTEGER,
  ADD CONSTRAINT "service_orders_discount_nonnegative" CHECK ("discount_cents" >= 0),
  ADD CONSTRAINT "service_orders_warranty_range" CHECK ("warranty_days" IS NULL OR ("warranty_days" >= 0 AND "warranty_days" <= 3650)),
  ADD CONSTRAINT "service_orders_exit_mileage_nonnegative" CHECK ("exit_mileage" IS NULL OR "exit_mileage" >= 0);
