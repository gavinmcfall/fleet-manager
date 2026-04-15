-- 0202_vehicle_types_powersuit_seed.sql
-- Add 'powersuit' to vehicle_types seed table. 8 ATLS powersuit rows otherwise
-- fail to resolve vehicle_type_id. vehicle_types originally seeded by 0001 with
-- spaceship (id=1), ground_vehicle (id=2), gravlev (id=3) — powersuit was missed.

INSERT OR IGNORE INTO vehicle_types (id, key, label) VALUES (4, 'powersuit', 'Powersuit');
