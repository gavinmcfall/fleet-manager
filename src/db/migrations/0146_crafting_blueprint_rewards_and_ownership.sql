-- 0146_crafting_blueprint_rewards_and_ownership.sql
-- Blueprint reward pools (mission → blueprint grants) and user blueprint ownership.
--
-- Reward pools: 45 pools, each containing weighted lists of blueprints
-- granted on mission completion. Pool key derived from DataCore record name.
--
-- User blueprints: account-bound blueprints synced via SC Bridge extension.
-- Will be populated once 4.7.0 goes LIVE and we can observe the hangar data.

-- Reward pools (one per mission context)
CREATE TABLE crafting_blueprint_reward_pools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    name TEXT,
    game_version_id INTEGER REFERENCES game_versions(id),
    UNIQUE(key, game_version_id)
);
CREATE INDEX idx_crafting_bp_reward_pools_version ON crafting_blueprint_reward_pools(game_version_id);

-- Pool items (blueprints in each pool, with weights for random selection)
CREATE TABLE crafting_blueprint_reward_pool_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crafting_blueprint_reward_pool_id INTEGER NOT NULL REFERENCES crafting_blueprint_reward_pools(id),
    crafting_blueprint_id INTEGER NOT NULL REFERENCES crafting_blueprints(id),
    weight INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_crafting_bp_reward_items_pool ON crafting_blueprint_reward_pool_items(crafting_blueprint_reward_pool_id);
CREATE INDEX idx_crafting_bp_reward_items_bp ON crafting_blueprint_reward_pool_items(crafting_blueprint_id);

-- User-owned blueprints (synced from SC Bridge extension)
CREATE TABLE user_blueprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES user(id),
    crafting_blueprint_id INTEGER REFERENCES crafting_blueprints(id),
    source TEXT,
    synced_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, crafting_blueprint_id)
);
CREATE INDEX idx_user_blueprints_user ON user_blueprints(user_id);
