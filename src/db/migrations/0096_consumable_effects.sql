-- Consumable effects junction table
-- Links consumable items (fps_utilities med pens, med guns) to their effect magnitudes/durations.
-- Effect keys reference consumable_effect_types. Source: consumabletypes.json effectsPerMicroSCU arrays.

CREATE TABLE IF NOT EXISTS consumable_effects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consumable_uuid TEXT NOT NULL,
  effect_key TEXT NOT NULL,
  magnitude REAL,
  duration_seconds REAL,
  game_version_id INTEGER NOT NULL REFERENCES game_versions(id),
  UNIQUE(consumable_uuid, effect_key, game_version_id)
);

CREATE INDEX idx_consumable_effects_uuid ON consumable_effects(consumable_uuid);
CREATE INDEX idx_consumable_effects_version ON consumable_effects(game_version_id);
