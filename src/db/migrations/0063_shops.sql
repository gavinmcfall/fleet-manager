-- Shops and shop inventory
-- Depends on: star_map_locations (0060)

CREATE TABLE shops (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  slug              TEXT,
  shop_type         TEXT,
  location_id       INTEGER REFERENCES star_map_locations(id),
  is_event          INTEGER DEFAULT 0,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')),
  UNIQUE(uuid, game_version_id)
);
CREATE INDEX idx_shops_type ON shops(shop_type);
CREATE INDEX idx_shops_location ON shops(location_id);
CREATE INDEX idx_shops_slug ON shops(slug);

CREATE TABLE shop_inventory (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id           INTEGER NOT NULL REFERENCES shops(id),
  item_uuid         TEXT    NOT NULL,
  item_name         TEXT,
  buy_price         REAL,
  sell_price        REAL,
  base_inventory    INTEGER,
  max_inventory     INTEGER,
  rental_available  INTEGER DEFAULT 0,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')),
  UNIQUE(shop_id, item_uuid, game_version_id)
);
CREATE INDEX idx_shop_inventory_item ON shop_inventory(item_uuid);
CREATE INDEX idx_shop_inventory_shop ON shop_inventory(shop_id);
