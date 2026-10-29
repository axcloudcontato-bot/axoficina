-- Opening hours that shape the agenda grid (0 = Sunday ... 6 = Saturday).
ALTER TABLE "tenants"
  ADD COLUMN "agenda_open_hour" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN "agenda_close_hour" INTEGER NOT NULL DEFAULT 18,
  ADD COLUMN "agenda_work_days" INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
  ADD CONSTRAINT "tenants_agenda_hours_range" CHECK ("agenda_open_hour" >= 0 AND "agenda_close_hour" <= 24 AND "agenda_open_hour" < "agenda_close_hour");
