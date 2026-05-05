-- 0216_dedupe_crafting_unique.sql
-- Surgical cleanup: duplicate rows accumulated in
-- crafting_blueprint_slots and crafting_slot_modifiers because the
-- 0129 schema lacks UNIQUE constraints on the natural keys and the
-- v2 pipeline emits plain INSERTs. This migration deletes losing
-- duplicates (keep MIN(id)) and adds UNIQUE indexes so the issue
-- cannot recur in storage.

-- 1. Delete modifiers attached to non-winning slots.
DELETE FROM crafting_slot_modifiers
WHERE crafting_blueprint_slot_id NOT IN (
  SELECT MIN(id)
  FROM crafting_blueprint_slots
  GROUP BY crafting_blueprint_id, slot_index
);

-- 2. Delete non-winning slot rows.
DELETE FROM crafting_blueprint_slots
WHERE id NOT IN (
  SELECT MIN(id)
  FROM crafting_blueprint_slots
  GROUP BY crafting_blueprint_id, slot_index
);

-- 3. Within the surviving slots, dedupe modifiers per (slot, property).
DELETE FROM crafting_slot_modifiers
WHERE id NOT IN (
  SELECT MIN(id)
  FROM crafting_slot_modifiers
  GROUP BY crafting_blueprint_slot_id, crafting_property_id
);

-- 4. Add UNIQUE indexes so future plain INSERTs fail loudly instead
--    of silently accumulating dupes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_crafting_blueprint_slots_unique
  ON crafting_blueprint_slots(crafting_blueprint_id, slot_index);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crafting_slot_modifiers_unique
  ON crafting_slot_modifiers(crafting_blueprint_slot_id, crafting_property_id);

-- 5. Create PTU shadow tables for crafting slots and modifiers
--    (ptu_crafting_blueprints exists from 0215 but these two were omitted).
--    Mirror the same cleanup + indexes so pipeline runs with --channel PTU
--    are also protected.
CREATE TABLE IF NOT EXISTS ptu_crafting_blueprint_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crafting_blueprint_id INTEGER NOT NULL REFERENCES ptu_crafting_blueprints(id),
    slot_index INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    resource_name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    min_quality INTEGER NOT NULL DEFAULT 0,
    blueprint_uuid TEXT,
    slot_name TEXT
);

CREATE INDEX IF NOT EXISTS ptu_idx_crafting_blueprint_slots_blueprint
  ON ptu_crafting_blueprint_slots(crafting_blueprint_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ptu_crafting_blueprint_slots_unique
  ON ptu_crafting_blueprint_slots(crafting_blueprint_id, slot_index);

CREATE TABLE IF NOT EXISTS ptu_crafting_slot_modifiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crafting_blueprint_slot_id INTEGER NOT NULL REFERENCES ptu_crafting_blueprint_slots(id),
    crafting_property_id INTEGER NOT NULL REFERENCES crafting_properties(id),
    start_quality INTEGER NOT NULL DEFAULT 0,
    end_quality INTEGER NOT NULL DEFAULT 1000,
    modifier_at_start REAL NOT NULL DEFAULT 1.0,
    modifier_at_end REAL NOT NULL DEFAULT 1.0,
    blueprint_uuid TEXT,
    property_id TEXT,
    slot_index INTEGER
);

CREATE INDEX IF NOT EXISTS ptu_idx_crafting_slot_modifiers_slot
  ON ptu_crafting_slot_modifiers(crafting_blueprint_slot_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ptu_crafting_slot_modifiers_unique
  ON ptu_crafting_slot_modifiers(crafting_blueprint_slot_id, crafting_property_id);
