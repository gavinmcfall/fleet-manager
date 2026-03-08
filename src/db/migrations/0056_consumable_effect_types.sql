-- Consumable effect type lookup table for buff/debuff descriptions
-- No FK dependencies on other new tables

CREATE TABLE consumable_effect_types (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  description TEXT,
  is_positive INTEGER DEFAULT 1
);
