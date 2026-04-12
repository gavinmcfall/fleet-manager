-- Dedupe crafting_blueprint_reward_pool_items + add natural-key UNIQUE.
-- Pipeline emits INSERT OR IGNORE but the table had no UNIQUE, so repeated
-- UPSERT runs silently duplicated every row. Keep the earliest id per (pool, blueprint)
-- pair and drop the rest.

DELETE FROM crafting_blueprint_reward_pool_items
WHERE id NOT IN (
  SELECT MIN(id) FROM crafting_blueprint_reward_pool_items
  GROUP BY crafting_blueprint_reward_pool_id, crafting_blueprint_id
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cbrpi_natural_key
  ON crafting_blueprint_reward_pool_items(crafting_blueprint_reward_pool_id, crafting_blueprint_id);
