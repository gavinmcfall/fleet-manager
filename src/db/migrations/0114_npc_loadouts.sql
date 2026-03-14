-- NPC factions and loadouts — what gear NPCs wear/carry by faction
CREATE TABLE npc_factions (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  code     TEXT NOT NULL,
  name     TEXT NOT NULL,
  UNIQUE(code)
);

CREATE TABLE npc_loadouts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path         TEXT NOT NULL,
  loadout_name      TEXT NOT NULL,
  faction_id        INTEGER REFERENCES npc_factions(id),
  category          TEXT NOT NULL,
  sub_category      TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id),
  created_at        TEXT DEFAULT (datetime('now')),
  UNIQUE(file_path, game_version_id)
);

CREATE TABLE npc_loadout_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  loadout_id        INTEGER NOT NULL REFERENCES npc_loadouts(id) ON DELETE CASCADE,
  port_name         TEXT NOT NULL,
  item_name         TEXT NOT NULL,
  tag               TEXT,
  parent_port       TEXT,
  loot_map_uuid     TEXT,
  game_version_id   INTEGER NOT NULL REFERENCES game_versions(id)
);

CREATE INDEX idx_npc_loadouts_faction ON npc_loadouts(faction_id);
CREATE INDEX idx_npc_loadouts_version ON npc_loadouts(game_version_id);
CREATE INDEX idx_npc_loadout_items_loadout ON npc_loadout_items(loadout_id);
CREATE INDEX idx_npc_loadout_items_item ON npc_loadout_items(item_name);
CREATE INDEX idx_npc_loadout_items_version ON npc_loadout_items(game_version_id);
