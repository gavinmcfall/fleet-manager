-- Drop dead gRPC sync tables — EAC killed gRPC interception, companion app
-- now uses log-scraping only. These tables had no data source since the
-- gRPC proxy was removed from the companion app (ce428ea).

DROP TABLE IF EXISTS companion_wallet_snapshots;
DROP TABLE IF EXISTS companion_wallet_current;
DROP TABLE IF EXISTS companion_friends;
DROP TABLE IF EXISTS companion_reputation_scores;
DROP TABLE IF EXISTS companion_reputation_history;
DROP TABLE IF EXISTS companion_blueprints;
DROP TABLE IF EXISTS companion_entitlements;
DROP TABLE IF EXISTS companion_missions;
DROP TABLE IF EXISTS companion_stats;
DROP TABLE IF EXISTS companion_sync_log;
