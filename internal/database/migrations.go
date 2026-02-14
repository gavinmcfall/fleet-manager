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
		db.migrationSettings(),
		db.migrationAIAnalyses(),
		// SC Wiki API tables (V1 - for API sync)
		db.migrationSCGameVersions(),
		db.migrationSCManufacturers(),
		db.migrationSCVehicles(),
		db.migrationSCItems(),
		db.migrationSCPorts(),
		db.migrationSCShipMatrixVehicles(),
		db.migrationSCCommLinks(),
		db.migrationSCGalactapedia(),
		db.migrationSCSyncMetadata(),
		// Note: V2 tables (manufacturers, sc_vehicles_v2) are for scunpacked-data repo sync
		// and are currently disabled. They use different schemas.
	}

	for i, m := range migrations {
		if _, err := db.conn.Exec(m); err != nil {
			return fmt.Errorf("migration %d: %w", i, err)
		}
	}

	// Safe ALTER TABLE migrations (ignore "column already exists" errors)
	safeAlters := []string{
		"ALTER TABLE vehicles ADD COLUMN loaner BOOLEAN NOT NULL DEFAULT FALSE",
		"ALTER TABLE vehicles ADD COLUMN paint_name TEXT NOT NULL DEFAULT ''",
		"ALTER TABLE hangar_imports ADD COLUMN ship_slug TEXT NOT NULL DEFAULT ''",
		"ALTER TABLE ships ADD COLUMN on_sale BOOLEAN NOT NULL DEFAULT FALSE",
		"ALTER TABLE ships ADD COLUMN image_url_small TEXT NOT NULL DEFAULT ''",
		"ALTER TABLE ships ADD COLUMN image_url_medium TEXT NOT NULL DEFAULT ''",
		"ALTER TABLE ships ADD COLUMN image_url_large TEXT NOT NULL DEFAULT ''",
	}
	for _, q := range safeAlters {
		db.conn.Exec(q) // Ignore errors - column may already exist
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
		loaner BOOLEAN NOT NULL DEFAULT FALSE,
		paint_name TEXT NOT NULL DEFAULT '',
		source TEXT NOT NULL DEFAULT 'fleetyards',
		last_synced_at %s
	)`, db.autoIncrement(), ts)
}


func (db *DB) migrationHangarImports() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS hangar_imports (
		id %s,
		vehicle_id INTEGER NOT NULL DEFAULT 0,
		ship_slug TEXT NOT NULL DEFAULT '',
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

func (db *DB) migrationSettings() string {
	return `CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY NOT NULL,
		value TEXT NOT NULL DEFAULT ''
	)`
}

func (db *DB) migrationAIAnalyses() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS ai_analyses (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		created_at %s NOT NULL DEFAULT CURRENT_TIMESTAMP,
		provider TEXT NOT NULL,
		model TEXT NOT NULL,
		vehicle_count INTEGER NOT NULL,
		analysis TEXT NOT NULL
	)`, ts)
}

// SC Wiki API Migrations

func (db *DB) migrationSCSyncMetadata() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS sc_sync_metadata (
		endpoint TEXT PRIMARY KEY NOT NULL,
		last_sync_at %s,
		last_updated_record %s,
		total_records INTEGER NOT NULL DEFAULT 0,
		sync_status TEXT NOT NULL DEFAULT '',
		error_message TEXT NOT NULL DEFAULT '',
		created_at %s,
		updated_at %s
	)`, ts, ts, ts, ts)
}

func (db *DB) migrationSCGameVersions() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS sc_game_versions (
		id %s,
		uuid TEXT UNIQUE,
		code TEXT UNIQUE NOT NULL,
		channel TEXT NOT NULL DEFAULT '',
		is_default BOOLEAN NOT NULL DEFAULT FALSE,
		released_at %s,
		data TEXT NOT NULL DEFAULT '',
		created_at %s,
		updated_at %s
	)`, db.autoIncrement(), ts, ts, ts)
}

func (db *DB) migrationSCManufacturers() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS sc_manufacturers (
		id %s,
		uuid TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL DEFAULT '',
		slug TEXT NOT NULL DEFAULT '',
		known_for TEXT NOT NULL DEFAULT '',
		description TEXT NOT NULL DEFAULT '',
		logo_url TEXT NOT NULL DEFAULT '',
		data TEXT NOT NULL DEFAULT '',
		created_at %s,
		updated_at %s
	)`, db.autoIncrement(), ts, ts)
}

func (db *DB) migrationSCVehicles() string {
	ts := db.timestampType()
	sql := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS sc_vehicles (
		id %s,
		uuid TEXT UNIQUE NOT NULL,
		class_name TEXT NOT NULL DEFAULT '',
		name TEXT NOT NULL DEFAULT '',
		slug TEXT NOT NULL DEFAULT '',
		manufacturer_id INTEGER,
		size INTEGER NOT NULL DEFAULT 0,
		size_class INTEGER NOT NULL DEFAULT 0,
		career TEXT NOT NULL DEFAULT '',
		role TEXT NOT NULL DEFAULT '',
		is_vehicle BOOLEAN NOT NULL DEFAULT FALSE,
		is_gravlev BOOLEAN NOT NULL DEFAULT FALSE,
		is_spaceship BOOLEAN NOT NULL DEFAULT FALSE,
		mass_total REAL NOT NULL DEFAULT 0,
		cargo_capacity REAL NOT NULL DEFAULT 0,
		vehicle_inventory REAL NOT NULL DEFAULT 0,
		crew_min INTEGER NOT NULL DEFAULT 0,
		crew_max INTEGER NOT NULL DEFAULT 0,
		speed_max REAL NOT NULL DEFAULT 0,
		game_version_id INTEGER,
		data TEXT NOT NULL DEFAULT '',
		created_at %s,
		updated_at %s
	)`, db.autoIncrement(), ts, ts)

	if db.driver == "sqlite" {
		return sql
	}
	// PostgreSQL indexes
	return sql + `
	CREATE INDEX IF NOT EXISTS idx_sc_vehicles_name ON sc_vehicles(name);
	CREATE INDEX IF NOT EXISTS idx_sc_vehicles_slug ON sc_vehicles(slug);
	CREATE INDEX IF NOT EXISTS idx_sc_vehicles_manufacturer ON sc_vehicles(manufacturer_id);
	CREATE INDEX IF NOT EXISTS idx_sc_vehicles_version ON sc_vehicles(game_version_id);
	`
}

func (db *DB) migrationSCItems() string {
	ts := db.timestampType()
	sql := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS sc_items (
		id %s,
		uuid TEXT UNIQUE NOT NULL,
		class_name TEXT NOT NULL DEFAULT '',
		name TEXT NOT NULL DEFAULT '',
		slug TEXT NOT NULL DEFAULT '',
		manufacturer_id INTEGER,
		type TEXT NOT NULL DEFAULT '',
		sub_type TEXT NOT NULL DEFAULT '',
		size INTEGER NOT NULL DEFAULT 0,
		grade TEXT NOT NULL DEFAULT '',
		data TEXT NOT NULL DEFAULT '',
		game_version_id INTEGER,
		created_at %s,
		updated_at %s
	)`, db.autoIncrement(), ts, ts)

	if db.driver == "sqlite" {
		return sql
	}
	// PostgreSQL indexes
	return sql + `
	CREATE INDEX IF NOT EXISTS idx_sc_items_name ON sc_items(name);
	CREATE INDEX IF NOT EXISTS idx_sc_items_type ON sc_items(type);
	CREATE INDEX IF NOT EXISTS idx_sc_items_manufacturer ON sc_items(manufacturer_id);
	`
}

func (db *DB) migrationSCShipMatrixVehicles() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS sc_shipmatrix_vehicles (
		id %s,
		uuid TEXT UNIQUE,
		name TEXT NOT NULL DEFAULT '',
		slug TEXT NOT NULL DEFAULT '',
		pledge_price REAL NOT NULL DEFAULT 0,
		price_auec REAL NOT NULL DEFAULT 0,
		sc_vehicle_uuid TEXT NOT NULL DEFAULT '',
		data TEXT NOT NULL DEFAULT '',
		created_at %s,
		updated_at %s
	)`, db.autoIncrement(), ts, ts)
}

func (db *DB) migrationSCCommLinks() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS sc_comm_links (
		id %s,
		uuid TEXT UNIQUE,
		title TEXT NOT NULL DEFAULT '',
		slug TEXT NOT NULL DEFAULT '',
		published_at %s,
		data TEXT NOT NULL DEFAULT '',
		created_at %s,
		updated_at %s
	)`, db.autoIncrement(), ts, ts, ts)
}

func (db *DB) migrationSCGalactapedia() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS sc_galactapedia (
		id %s,
		uuid TEXT UNIQUE,
		title TEXT NOT NULL DEFAULT '',
		slug TEXT NOT NULL DEFAULT '',
		data TEXT NOT NULL DEFAULT '',
		created_at %s,
		updated_at %s
	)`, db.autoIncrement(), ts, ts)
}

func (db *DB) migrationSCCelestialObjects() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS sc_celestial_objects (
		id %s,
		uuid TEXT UNIQUE,
		name TEXT NOT NULL DEFAULT '',
		type TEXT NOT NULL DEFAULT '',
		data TEXT NOT NULL DEFAULT '',
		created_at %s,
		updated_at %s
	)`, db.autoIncrement(), ts, ts)
}

func (db *DB) migrationSCStarsystems() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS sc_starsystems (
		id %s,
		uuid TEXT UNIQUE,
		name TEXT NOT NULL DEFAULT '',
		data TEXT NOT NULL DEFAULT '',
		created_at %s,
		updated_at %s
	)`, db.autoIncrement(), ts, ts)
}

// V2 Migrations for scunpacked-data (simplified schema)

func (db *DB) migrationSCManufacturersV2() string {
	ts := db.timestampType()
	sql := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS manufacturers (
		uuid TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		code TEXT NOT NULL UNIQUE,
		known_for TEXT,
		description TEXT,
		created_at %s DEFAULT CURRENT_TIMESTAMP,
		updated_at %s DEFAULT CURRENT_TIMESTAMP
	)`, ts, ts)

	if db.driver == "sqlite" {
		return sql
	}
	return sql + `
	CREATE INDEX IF NOT EXISTS idx_manufacturers_code ON manufacturers(code);
	`
}

func (db *DB) migrationSCVehiclesV2() string {
	ts := db.timestampType()
	fk := ""
	if db.driver == "postgres" {
		fk = "FOREIGN KEY (manufacturer_uuid) REFERENCES manufacturers(uuid) ON DELETE SET NULL,"
	}

	sql := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS sc_vehicles_v2 (
		uuid TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		class_name TEXT,
		manufacturer_uuid TEXT,
		%s
		size_class INTEGER,
		focus TEXT,
		type TEXT,
		is_spaceship BOOLEAN DEFAULT true,
		is_vehicle BOOLEAN DEFAULT false,
		is_gravlev BOOLEAN DEFAULT false,
		production_status TEXT,
		length REAL,
		width REAL,
		height REAL,
		mass_hull REAL,
		mass_loadout REAL,
		mass_total REAL,
		cargo_capacity REAL,
		vehicle_inventory REAL,
		crew_min INTEGER,
		crew_max INTEGER,
		crew_weapon INTEGER,
		health REAL,
		speed_scm REAL,
		speed_max REAL,
		agility_pitch REAL,
		agility_yaw REAL,
		agility_roll REAL,
		shield_hp REAL,
		shield_regen REAL,
		shield_face_type TEXT,
		game_version TEXT,
		created_at %s DEFAULT CURRENT_TIMESTAMP,
		updated_at %s DEFAULT CURRENT_TIMESTAMP
	)`, fk, ts, ts)

	if db.driver == "sqlite" {
		return sql
	}
	return sql + `
	CREATE INDEX IF NOT EXISTS idx_sc_vehicles_v2_manufacturer ON sc_vehicles_v2(manufacturer_uuid);
	CREATE INDEX IF NOT EXISTS idx_sc_vehicles_v2_type ON sc_vehicles_v2(type);
	CREATE INDEX IF NOT EXISTS idx_sc_vehicles_v2_focus ON sc_vehicles_v2(focus);
	CREATE INDEX IF NOT EXISTS idx_sc_vehicles_v2_production_status ON sc_vehicles_v2(production_status);
	`
}

func (db *DB) migrationSCPorts() string {
	ts := db.timestampType()
	fk := ""
	if db.driver == "postgres" {
		fk = `
		FOREIGN KEY (vehicle_uuid) REFERENCES sc_vehicles_v2(uuid) ON DELETE CASCADE,
		FOREIGN KEY (parent_port_id) REFERENCES sc_ports(id) ON DELETE CASCADE,
		FOREIGN KEY (equipped_item_uuid) REFERENCES sc_items_v2(uuid) ON DELETE SET NULL,
		`
	}

	sql := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS sc_ports (
		id %s,
		uuid TEXT UNIQUE,
		vehicle_uuid TEXT NOT NULL,
		parent_port_id INTEGER,
		%s
		name TEXT NOT NULL,
		position TEXT,
		category_label TEXT,
		size_min INTEGER,
		size_max INTEGER,
		port_type TEXT,
		port_subtype TEXT,
		class_name TEXT,
		equipped_item_uuid TEXT,
		editable BOOLEAN,
		editable_children BOOLEAN,
		health REAL,
		created_at %s DEFAULT CURRENT_TIMESTAMP
	)`, db.autoIncrement(), fk, ts)

	if db.driver == "sqlite" {
		return sql
	}
	return sql + `
	CREATE INDEX IF NOT EXISTS idx_sc_ports_vehicle ON sc_ports(vehicle_uuid);
	CREATE INDEX IF NOT EXISTS idx_sc_ports_parent ON sc_ports(parent_port_id);
	CREATE INDEX IF NOT EXISTS idx_sc_ports_item ON sc_ports(equipped_item_uuid);
	CREATE INDEX IF NOT EXISTS idx_sc_ports_category ON sc_ports(category_label);
	CREATE INDEX IF NOT EXISTS idx_sc_ports_type ON sc_ports(port_type);
	`
}

func (db *DB) migrationSCItemsV2() string {
	ts := db.timestampType()
	fk := ""
	if db.driver == "postgres" {
		fk = "FOREIGN KEY (manufacturer_uuid) REFERENCES manufacturers(uuid) ON DELETE SET NULL,"
	}

	sql := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS sc_items_v2 (
		uuid TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		class_name TEXT NOT NULL,
		manufacturer_uuid TEXT,
		%s
		type TEXT NOT NULL,
		sub_type TEXT,
		classification TEXT,
		size INTEGER,
		grade INTEGER,
		class TEXT,
		width REAL,
		height REAL,
		length REAL,
		mass REAL,
		volume_scu REAL,
		description TEXT,
		metadata TEXT,
		is_base_variant BOOLEAN,
		tags TEXT,
		game_version TEXT,
		created_at %s DEFAULT CURRENT_TIMESTAMP,
		updated_at %s DEFAULT CURRENT_TIMESTAMP
	)`, fk, ts, ts)

	if db.driver == "sqlite" {
		return sql
	}
	return sql + `
	CREATE INDEX IF NOT EXISTS idx_sc_items_v2_manufacturer ON sc_items_v2(manufacturer_uuid);
	CREATE INDEX IF NOT EXISTS idx_sc_items_v2_type ON sc_items_v2(type);
	CREATE INDEX IF NOT EXISTS idx_sc_items_v2_sub_type ON sc_items_v2(sub_type);
	CREATE INDEX IF NOT EXISTS idx_sc_items_v2_classification ON sc_items_v2(classification);
	CREATE INDEX IF NOT EXISTS idx_sc_items_v2_size ON sc_items_v2(size);
	CREATE INDEX IF NOT EXISTS idx_sc_items_v2_grade ON sc_items_v2(grade);
	`
}

func (db *DB) migrationSCVehicleLoaners() string {
	fk := ""
	if db.driver == "postgres" {
		fk = `,
		FOREIGN KEY (vehicle_uuid) REFERENCES sc_vehicles_v2(uuid) ON DELETE CASCADE,
		FOREIGN KEY (loaner_uuid) REFERENCES sc_vehicles_v2(uuid) ON DELETE CASCADE
		`
	}

	sql := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS sc_vehicle_loaners (
		vehicle_uuid TEXT NOT NULL,
		loaner_uuid TEXT NOT NULL,
		PRIMARY KEY (vehicle_uuid, loaner_uuid)
		%s
	)`, fk)

	if db.driver == "sqlite" {
		return sql
	}
	return sql + `
	CREATE INDEX IF NOT EXISTS idx_sc_vehicle_loaners_vehicle ON sc_vehicle_loaners(vehicle_uuid);
	CREATE INDEX IF NOT EXISTS idx_sc_vehicle_loaners_loaner ON sc_vehicle_loaners(loaner_uuid);
	`
}

func (db *DB) migrationSCSyncStatus() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS sc_sync_status (
		id %s,
		category TEXT NOT NULL UNIQUE,
		last_synced_at %s,
		file_checksum TEXT,
		status TEXT,
		error_message TEXT,
		records_synced INTEGER DEFAULT 0
	)`, db.autoIncrement(), ts)
}
