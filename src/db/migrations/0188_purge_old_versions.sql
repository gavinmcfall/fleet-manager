-- 0188_purge_old_versions.sql
-- Consolidate to single version. For each table with multi-version data,
-- keep the newest row per natural key, delete older duplicates, then
-- update all remaining rows to the default version (98 = 4.7.1-live).

-- ── Vehicles ─────────────────────────────────────────────────────────
-- No slug overlap between v97 and v98 (different slug conventions).
-- Just update any non-default version rows to default.
UPDATE vehicles SET game_version_id = (SELECT id FROM game_versions WHERE is_default = 1)
  WHERE game_version_id != (SELECT id FROM game_versions WHERE is_default = 1);

-- ── Reputation standings ─────────────────────────────────────────────
-- v96 (263 rows) + v97 (261 rows) overlap by (uuid, scope_id).
-- reputation_perks.standing_id references reputation_standings.id — must
-- delete perks referencing old standings before deduplicating.
DELETE FROM reputation_perks
  WHERE standing_id IN (
    SELECT id FROM reputation_standings
    WHERE id NOT IN (SELECT MAX(id) FROM reputation_standings GROUP BY uuid, scope_id)
  );
-- Keep newest (highest id) per natural key, delete older duplicates.
DELETE FROM reputation_standings
  WHERE id NOT IN (
    SELECT MAX(id) FROM reputation_standings GROUP BY uuid, scope_id
  );
-- Now update survivors to default version
UPDATE reputation_standings SET game_version_id = (SELECT id FROM game_versions WHERE is_default = 1)
  WHERE game_version_id != (SELECT id FROM game_versions WHERE is_default = 1);
-- Update perks to default version too
UPDATE reputation_perks SET game_version_id = (SELECT id FROM game_versions WHERE is_default = 1)
  WHERE game_version_id != (SELECT id FROM game_versions WHERE is_default = 1);

-- ── Contracts ────────────────────────────────────────────────────────
-- All at v97, none at v98. Dedup by contract_key (keep newest).
DELETE FROM contracts
  WHERE id NOT IN (
    SELECT MAX(id) FROM contracts GROUP BY contract_key
  );
UPDATE contracts SET game_version_id = (SELECT id FROM game_versions WHERE is_default = 1)
  WHERE game_version_id != (SELECT id FROM game_versions WHERE is_default = 1);

-- ── Catch-all: any table that might have non-default version rows ───
-- For tables where UNIQUE includes game_version_id, dedup first by
-- keeping MAX(id) per natural key, then update version.
-- Most of these are no-ops (data already at v98).

-- Tables with potential multi-version data (dedup by natural key)
DELETE FROM commodities WHERE id NOT IN (SELECT MAX(id) FROM commodities GROUP BY uuid);
UPDATE commodities SET game_version_id = (SELECT id FROM game_versions WHERE is_default = 1) WHERE game_version_id != (SELECT id FROM game_versions WHERE is_default = 1);

DELETE FROM faction_reputation_scopes WHERE id NOT IN (SELECT MAX(id) FROM faction_reputation_scopes GROUP BY faction_id, reputation_scope_id);
UPDATE faction_reputation_scopes SET game_version_id = (SELECT id FROM game_versions WHERE is_default = 1) WHERE game_version_id != (SELECT id FROM game_versions WHERE is_default = 1);

DELETE FROM reputation_scopes WHERE id NOT IN (SELECT MAX(id) FROM reputation_scopes GROUP BY uuid);
UPDATE reputation_scopes SET game_version_id = (SELECT id FROM game_versions WHERE is_default = 1) WHERE game_version_id != (SELECT id FROM game_versions WHERE is_default = 1);

-- Simple version updates (no dedup needed — single natural key, no overlaps expected)
UPDATE contract_blueprint_reward_pools SET game_version_id = (SELECT id FROM game_versions WHERE is_default = 1) WHERE game_version_id != (SELECT id FROM game_versions WHERE is_default = 1);
UPDATE contract_generator_blueprint_pools SET game_version_id = (SELECT id FROM game_versions WHERE is_default = 1) WHERE game_version_id != (SELECT id FROM game_versions WHERE is_default = 1);
UPDATE contract_generator_careers SET game_version_id = (SELECT id FROM game_versions WHERE is_default = 1) WHERE game_version_id != (SELECT id FROM game_versions WHERE is_default = 1);
UPDATE contract_generator_contracts SET game_version_id = (SELECT id FROM game_versions WHERE is_default = 1) WHERE game_version_id != (SELECT id FROM game_versions WHERE is_default = 1);
UPDATE contract_generators SET game_version_id = (SELECT id FROM game_versions WHERE is_default = 1) WHERE game_version_id != (SELECT id FROM game_versions WHERE is_default = 1);
UPDATE crafting_blueprint_reward_pools SET game_version_id = (SELECT id FROM game_versions WHERE is_default = 1) WHERE game_version_id != (SELECT id FROM game_versions WHERE is_default = 1);
UPDATE mission_givers SET game_version_id = (SELECT id FROM game_versions WHERE is_default = 1) WHERE game_version_id != (SELECT id FROM game_versions WHERE is_default = 1);
UPDATE mission_organizations SET game_version_id = (SELECT id FROM game_versions WHERE is_default = 1) WHERE game_version_id != (SELECT id FROM game_versions WHERE is_default = 1);
UPDATE mission_types SET game_version_id = (SELECT id FROM game_versions WHERE is_default = 1) WHERE game_version_id != (SELECT id FROM game_versions WHERE is_default = 1);
