-- User loadout customization and shopping cart
-- Depends on: user_fleet, vehicle_ports, vehicle_components, shops

-- User's custom component choices per fleet ship + port.
-- Only stores overrides — absent ports use stock components.
CREATE TABLE user_fleet_loadout (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          TEXT    NOT NULL,
  user_fleet_id    INTEGER NOT NULL REFERENCES user_fleet(id) ON DELETE CASCADE,
  port_id          INTEGER NOT NULL REFERENCES vehicle_ports(id),
  component_id     INTEGER NOT NULL REFERENCES vehicle_components(id),
  created_at       TEXT    DEFAULT (datetime('now')),
  updated_at       TEXT    DEFAULT (datetime('now')),
  UNIQUE(user_id, user_fleet_id, port_id)
);
CREATE INDEX idx_ufl_user ON user_fleet_loadout(user_id);
CREATE INDEX idx_ufl_fleet ON user_fleet_loadout(user_fleet_id);

-- Persistent shopping cart for components
CREATE TABLE user_loadout_cart (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          TEXT    NOT NULL,
  component_id     INTEGER NOT NULL REFERENCES vehicle_components(id),
  shop_id          INTEGER REFERENCES shops(id),
  quantity         INTEGER NOT NULL DEFAULT 1,
  source_fleet_id  INTEGER REFERENCES user_fleet(id) ON DELETE SET NULL,
  created_at       TEXT    DEFAULT (datetime('now')),
  UNIQUE(user_id, component_id, source_fleet_id)
);
CREATE INDEX idx_ulc_user ON user_loadout_cart(user_id);
