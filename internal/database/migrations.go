package database

import (
	"fmt"

	"github.com/rs/zerolog/log"
)

func (db *DB) migrate() error {
	log.Info().Msg("running database migrations")

	migrations := []string{
		db.migrationShips(),
		db.migrationVehicles(),
		db.migrationHangarImports(),
		db.migrationSyncStatus(),
	}

	for i, m := range migrations {
		if _, err := db.conn.Exec(m); err != nil {
			return fmt.Errorf("migration %d: %w", i, err)
		}
	}

	log.Info().Msg("migrations complete")
	return nil
}

func (db *DB) migrationShips() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS ships (
		id %s,
		slug TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL DEFAULT '',
		sc_identifier TEXT NOT NULL DEFAULT '',
		manufacturer_name TEXT NOT NULL DEFAULT '',
		manufacturer_code TEXT NOT NULL DEFAULT '',
		focus TEXT NOT NULL DEFAULT '',
		size_label TEXT NOT NULL DEFAULT '',
		length REAL NOT NULL DEFAULT 0,
		beam REAL NOT NULL DEFAULT 0,
		height REAL NOT NULL DEFAULT 0,
		mass REAL NOT NULL DEFAULT 0,
		cargo REAL NOT NULL DEFAULT 0,
		min_crew INTEGER NOT NULL DEFAULT 0,
		max_crew INTEGER NOT NULL DEFAULT 0,
		scm_speed REAL NOT NULL DEFAULT 0,
		pledge_price REAL NOT NULL DEFAULT 0,
		production_status TEXT NOT NULL DEFAULT '',
		description TEXT NOT NULL DEFAULT '',
		classification TEXT NOT NULL DEFAULT '',
		image_url TEXT NOT NULL DEFAULT '',
		fleetyards_url TEXT NOT NULL DEFAULT '',
		last_synced_at %s,
		raw_json TEXT NOT NULL DEFAULT ''
	)`, db.autoIncrement(), ts)
}

func (db *DB) migrationVehicles() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS vehicles (
		id %s,
		ship_slug TEXT NOT NULL DEFAULT '',
		ship_name TEXT NOT NULL DEFAULT '',
		custom_name TEXT NOT NULL DEFAULT '',
		manufacturer_name TEXT NOT NULL DEFAULT '',
		manufacturer_code TEXT NOT NULL DEFAULT '',
		flagship BOOLEAN NOT NULL DEFAULT FALSE,
		public BOOLEAN NOT NULL DEFAULT TRUE,
		source TEXT NOT NULL DEFAULT 'fleetyards',
		last_synced_at %s,
		UNIQUE(ship_slug, source)
	)`, db.autoIncrement(), ts)
}

func (db *DB) migrationHangarImports() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS hangar_imports (
		id %s,
		vehicle_id INTEGER NOT NULL DEFAULT 0,
		ship_code TEXT NOT NULL DEFAULT '',
		lti BOOLEAN NOT NULL DEFAULT FALSE,
		warbond BOOLEAN NOT NULL DEFAULT FALSE,
		pledge_id TEXT UNIQUE NOT NULL,
		pledge_name TEXT NOT NULL DEFAULT '',
		pledge_date TEXT NOT NULL DEFAULT '',
		pledge_cost TEXT NOT NULL DEFAULT '',
		entity_type TEXT NOT NULL DEFAULT '',
		imported_at %s
	)`, db.autoIncrement(), ts)
}

func (db *DB) migrationSyncStatus() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS sync_status (
		id %s,
		sync_type TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT '',
		item_count INTEGER NOT NULL DEFAULT 0,
		error_message TEXT NOT NULL DEFAULT '',
		started_at %s,
		completed_at %s
	)`, db.autoIncrement(), ts, ts)
}
