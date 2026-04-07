-- 0184_shop_terminal_tables.sql
-- Three-layer shop model: shops -> terminals -> terminal_inventory
-- Additive migration — shop_inventory kept until routes updated (see 0185)

-- Terminals: kiosks within shops. Bridge between shop identity and inventory.
CREATE TABLE terminals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  shop_id INTEGER REFERENCES shops(id),
  shop_name_key TEXT NOT NULL UNIQUE,
  terminal_type TEXT,
  uex_terminal_id INTEGER,
  game_version_id INTEGER REFERENCES game_versions(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_terminals_shop ON terminals(shop_id);
CREATE INDEX idx_terminals_type ON terminals(terminal_type);
CREATE INDEX idx_terminals_uex ON terminals(uex_terminal_id);

-- Terminal inventory: what's available where, with base + latest prices
CREATE TABLE terminal_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  terminal_id INTEGER NOT NULL REFERENCES terminals(id),
  item_uuid TEXT NOT NULL,
  item_type TEXT,
  item_name TEXT,
  base_buy_price REAL,
  base_sell_price REAL,
  latest_buy_price REAL,
  latest_sell_price REAL,
  latest_source TEXT,
  latest_observed_at TEXT,
  base_inventory REAL,
  max_inventory REAL,
  game_version_id INTEGER REFERENCES game_versions(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(terminal_id, item_uuid, game_version_id)
);

CREATE INDEX idx_terminal_inventory_item ON terminal_inventory(item_uuid);
CREATE INDEX idx_terminal_inventory_terminal ON terminal_inventory(terminal_id);

-- Price observations: append-only history from all sources (Phase 2)
CREATE TABLE price_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  terminal_id INTEGER NOT NULL REFERENCES terminals(id),
  item_uuid TEXT NOT NULL,
  observation_type TEXT NOT NULL,
  price REAL NOT NULL,
  quantity INTEGER,
  price_per_unit REAL,
  source TEXT NOT NULL,
  user_id TEXT,
  observed_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_price_observations_terminal ON price_observations(terminal_id);
CREATE INDEX idx_price_observations_item ON price_observations(item_uuid);
CREATE INDEX idx_price_observations_observed ON price_observations(observed_at);

-- Unlinked sources: unknown shops from UEX/companion (Phase 2)
CREATE TABLE unlinked_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  source_identifier TEXT NOT NULL,
  raw_data TEXT,
  resolved INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Migrate existing data: create one terminal per shop
INSERT INTO terminals (uuid, shop_id, shop_name_key, terminal_type, game_version_id)
SELECT
  s.uuid,
  s.id,
  s.name,
  CASE
    WHEN s.shop_type IN ('admin', 'commodity') THEN 'commodity'
    WHEN s.shop_type = 'ships' THEN 'vehicle'
    ELSE 'item'
  END,
  s.game_version_id
FROM shops s;

-- Migrate shop_inventory rows to terminal_inventory
INSERT INTO terminal_inventory (terminal_id, item_uuid, item_type, item_name,
  base_buy_price, base_sell_price, base_inventory, max_inventory, game_version_id)
SELECT
  t.id,
  si.item_uuid,
  CASE
    WHEN EXISTS(SELECT 1 FROM trade_commodities tc WHERE tc.uuid = si.item_uuid) THEN 'commodity'
    WHEN EXISTS(SELECT 1 FROM vehicles v WHERE v.uuid = si.item_uuid) THEN 'vehicle'
    ELSE 'item'
  END,
  si.item_name,
  si.buy_price,
  si.sell_price,
  si.base_inventory,
  si.max_inventory,
  si.game_version_id
FROM shop_inventory si
JOIN terminals t ON t.shop_id = si.shop_id;
