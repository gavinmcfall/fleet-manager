-- Commodity shop listings: where to buy/sell commodities
-- Depends on: commodities (0057), shops (0063)

CREATE TABLE commodity_shop_listings (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  commodity_id      INTEGER NOT NULL REFERENCES commodities(id),
  shop_id           INTEGER NOT NULL REFERENCES shops(id),
  buy_price         REAL,
  sell_price        REAL,
  max_inventory     INTEGER,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT    DEFAULT (datetime('now')),
  updated_at        TEXT    DEFAULT (datetime('now')),
  UNIQUE(commodity_id, shop_id, game_version_id)
);
CREATE INDEX idx_commodity_shop_commodity ON commodity_shop_listings(commodity_id);
CREATE INDEX idx_commodity_shop_shop ON commodity_shop_listings(shop_id);
