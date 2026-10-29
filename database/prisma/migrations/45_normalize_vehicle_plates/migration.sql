-- Plates are stored upper case without hyphen or spaces (ABC1D23), so the same car cannot be registered twice
-- under different spellings. Only vehicles whose normalized plate is free are rewritten: if two active vehicles
-- of a workshop would end up with the same plate, the one already written correctly (or the oldest) keeps it and
-- the other is left as it is, for someone to look at.
WITH candidates AS (
  SELECT id,
         upper(regexp_replace(plate, '[^A-Za-z0-9]', '', 'g')) AS normalized,
         row_number() OVER (
           PARTITION BY tenant_id, upper(regexp_replace(plate, '[^A-Za-z0-9]', '', 'g'))
           ORDER BY (plate = upper(regexp_replace(plate, '[^A-Za-z0-9]', '', 'g'))) DESC, created_at
         ) AS position
  FROM "vehicles"
  WHERE "deleted_at" IS NULL
)
UPDATE "vehicles" v
SET "plate" = c.normalized
FROM candidates c
WHERE v."id" = c.id AND c.position = 1 AND v."plate" <> c.normalized AND c.normalized <> '';
