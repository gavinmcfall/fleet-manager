-- Localization Builder — user preferences for custom global.ini generation
-- Two features: ASOP fleet ordering (numbered ship names) and auto-generated item labels
-- (enriched with manufacturer, size, grade, class metadata)

CREATE TABLE user_localization_configs (
  id                         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id                    TEXT    NOT NULL UNIQUE,
  asop_enabled               INTEGER NOT NULL DEFAULT 0,
  labels_vehicle_components  INTEGER NOT NULL DEFAULT 0,
  labels_fps_weapons         INTEGER NOT NULL DEFAULT 0,
  labels_fps_armour          INTEGER NOT NULL DEFAULT 0,
  labels_fps_helmets         INTEGER NOT NULL DEFAULT 0,
  labels_fps_attachments     INTEGER NOT NULL DEFAULT 0,
  labels_fps_utilities       INTEGER NOT NULL DEFAULT 0,
  labels_consumables         INTEGER NOT NULL DEFAULT 0,
  labels_ship_missiles       INTEGER NOT NULL DEFAULT 0,
  label_format               TEXT    NOT NULL DEFAULT 'suffix',
  updated_at                 TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE user_localization_ship_order (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT    NOT NULL,
  vehicle_id      INTEGER NOT NULL REFERENCES vehicles(id),
  sort_position   INTEGER NOT NULL,
  custom_label    TEXT,
  UNIQUE(user_id, vehicle_id),
  UNIQUE(user_id, sort_position)
);

CREATE INDEX idx_user_localization_ship_order_user
  ON user_localization_ship_order(user_id);
