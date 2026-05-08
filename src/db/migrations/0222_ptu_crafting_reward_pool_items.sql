-- 0222_ptu_crafting_reward_pool_items.sql
-- Add the missing PTU shadow table for crafting_blueprint_reward_pool_items.
-- The base table was created in 0146 + extended in 0178, but no ptu_* shadow
-- was created in the 0215 batch. The /api/gamedata/crafting route uses the
-- channel-aware table resolver and 500s on PTU because the table is absent.

CREATE TABLE IF NOT EXISTS ptu_crafting_blueprint_reward_pool_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crafting_blueprint_reward_pool_id INTEGER NOT NULL REFERENCES ptu_crafting_blueprint_reward_pools(id),
    crafting_blueprint_id INTEGER NOT NULL REFERENCES ptu_crafting_blueprints(id),
    weight INTEGER NOT NULL DEFAULT 1,
    pool_key TEXT,
    blueprint_uuid TEXT
);

CREATE INDEX IF NOT EXISTS idx_ptu_crafting_bp_reward_items_pool
    ON ptu_crafting_blueprint_reward_pool_items(crafting_blueprint_reward_pool_id);
CREATE INDEX IF NOT EXISTS idx_ptu_crafting_bp_reward_items_bp
    ON ptu_crafting_blueprint_reward_pool_items(crafting_blueprint_id);

-- Match the natural-key UNIQUE that 0191 added to the base table.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ptu_crafting_bp_reward_items_unique
    ON ptu_crafting_blueprint_reward_pool_items(crafting_blueprint_reward_pool_id, crafting_blueprint_id);
