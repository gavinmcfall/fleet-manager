-- Trade commodities extracted from DataCore entity records.
-- These are the items traded at admin (commodity) shops — metals, minerals,
-- gases, food, vice, etc. UUIDs match shop_inventory.item_uuid.

CREATE TABLE IF NOT EXISTS trade_commodities (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid            TEXT NOT NULL,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL,
    class_name      TEXT,
    category        TEXT,        -- Directory category: metals, minerals, gas, vice, food, etc.
    type_name       TEXT,        -- Commodity type: Metal, Gas, Mineral, etc.
    subtype_name    TEXT,        -- Commodity subtype: Agricium, Hydrogen, etc.
    is_raw          INTEGER DEFAULT 0,  -- 1 = unrefined/ore form
    boxable         INTEGER DEFAULT 0,  -- 1 = can be boxed as physical commodity
    scu_per_unit    REAL,        -- SCU occupancy per unit (from centiSCU / 100)
    description     TEXT,
    game_version_id INTEGER REFERENCES game_versions(id),
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now')),
    UNIQUE(uuid, game_version_id)
);

CREATE INDEX IF NOT EXISTS idx_trade_commodities_category ON trade_commodities(category);
CREATE INDEX IF NOT EXISTS idx_trade_commodities_slug ON trade_commodities(slug);
