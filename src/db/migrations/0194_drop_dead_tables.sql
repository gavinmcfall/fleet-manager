-- 0194_drop_dead_tables.sql
-- Remove tables superseded by newer schema.
--   commodities → trade_commodities (created in 0069_trade_commodities.sql)
--   fps_ammo    → fps_ammo_types    (created in 0085-0087)
-- Both have zero rows on scbridge-staging and zero code references.
-- Also drop PTU shadow tables if present.

DROP TABLE IF EXISTS commodities;
DROP TABLE IF EXISTS fps_ammo;
DROP TABLE IF EXISTS ptu_commodities;
DROP TABLE IF EXISTS ptu_fps_ammo;
