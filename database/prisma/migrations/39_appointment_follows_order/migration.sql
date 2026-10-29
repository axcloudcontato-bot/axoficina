-- Appointments started before the order lifecycle closed them stayed IN_SERVICE forever.
-- Close them according to the order they generated.
UPDATE "appointments" a
SET "status" = 'COMPLETED', "updated_at" = now()
FROM "service_orders" o
WHERE a."service_order_id" = o."id" AND a."status" = 'IN_SERVICE' AND o."status" = 'DELIVERED';

UPDATE "appointments" a
SET "status" = 'CANCELLED', "cancelled_at" = COALESCE(o."closed_at", o."deleted_at", now()), "updated_at" = now()
FROM "service_orders" o
WHERE a."service_order_id" = o."id" AND a."status" = 'IN_SERVICE' AND (o."status" = 'CANCELLED' OR o."deleted_at" IS NOT NULL);
