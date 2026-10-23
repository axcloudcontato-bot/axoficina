ALTER TABLE service_order_photos
  ADD COLUMN angle TEXT,
  ADD COLUMN service_order_item_id UUID;

-- Fotos ativas anteriores a esta migração não têm ângulo/item (sistema
-- antigo era "1 foto qualquer por categoria") e não dá pra inferir qual dos
-- 6 ângulos ou qual item elas representam. Soft-delete em vez de perder o
-- arquivo: some da galeria nova (que exige a estrutura), mas o histórico
-- permanece no storage/na tabela pra auditoria.
UPDATE service_order_photos
  SET deleted_at = NOW()
  WHERE deleted_at IS NULL;

-- Padrão fixo de 6 ângulos (mesmos na entrada e na saída, pra comparação
-- direta antes/depois). Soft-deleted ficam de fora: dado histórico anterior
-- a esta migração não tinha ângulo/item e não deve quebrar.
ALTER TABLE service_order_photos
  ADD CONSTRAINT service_order_photos_angle_category_check
  CHECK (
    deleted_at IS NOT NULL
    OR (category IN ('ENTRY', 'EXIT') AND angle IS NOT NULL AND service_order_item_id IS NULL)
    OR (category IN ('ISSUE', 'RESOLVED') AND service_order_item_id IS NOT NULL AND angle IS NULL)
  );

ALTER TABLE service_order_photos
  ADD CONSTRAINT service_order_photos_angle_check
  CHECK (angle IS NULL OR angle IN ('FRONT', 'REAR', 'LEFT_SIDE', 'RIGHT_SIDE', 'SPARE_TIRE', 'DASHBOARD'));

CREATE INDEX service_order_photos_item_idx
  ON service_order_photos (service_order_item_id)
  WHERE deleted_at IS NULL AND service_order_item_id IS NOT NULL;
