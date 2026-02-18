package database

import (
	"fmt"

	"github.com/rs/zerolog/log"
)

func (db *DB) migrate() error {
	log.Info().Msg("running database migrations")

	// Step 1: Rename old tables if they exist (safe to re-run)
	db.renameOldTables()

	// Step 2: Create new schema
	migrations := []string{
		// Lookup tables
		db.migrationVehicleTypes(),
		db.migrationInsuranceTypes(),
		db.migrationSyncSources(),
		db.migrationProductionStatuses(),
		// Core reference data
		db.migrationManufacturers(),
		db.migrationGameVersions(),
		db.migrationVehicles(),
		db.migrationPorts(),
		db.migrationComponents(),
		db.migrationFPSWeapons(),
		db.migrationFPSArmour(),
		db.migrationFPSAttachments(),
		db.migrationFPSAmmo(),
		db.migrationFPSUtilities(),
		db.migrationPaints(),
		db.migrationPaintVehicles(),
		db.migrationVehicleLoaners(),
		// User data
		db.migrationUsers(),
		db.migrationUserFleet(),
		db.migrationUserPaints(),
		db.migrationUserLLMConfigs(),
		db.migrationUserSettings(),
		// Sync & audit
		db.migrationSyncHistory(),
		db.migrationAIAnalyses(),
		db.migrationAppSettings(),
	}

	for i, m := range migrations {
		if _, err := db.conn.Exec(m); err != nil {
			return fmt.Errorf("migration %d: %w", i, err)
		}
	}

	// Step 3: Create indexes
	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_paint_vehicles_vehicle_id ON paint_vehicles(vehicle_id)",
		"CREATE INDEX IF NOT EXISTS idx_user_fleet_user_id ON user_fleet(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_sync_history_started_at ON sync_history(started_at)",
	}
	for _, idx := range indexes {
		if _, err := db.conn.Exec(idx); err != nil {
			return fmt.Errorf("index creation: %w", err)
		}
	}

	// Step 4: Add columns to existing tables (idempotent)
	db.migratePaintsAddColumns()

	// Step 5: Seed lookup tables
	db.seedLookupTables()

	// Step 6: Create default user if none exists
	db.ensureDefaultUser()

	// Step 7: Drop legacy tables (data has been migrated to default user)
	db.dropOldTables()

	log.Info().Msg("migrations complete")
	return nil
}

// renameOldTables renames legacy tables so new schema can use the clean names.
// Errors are ignored — tables may not exist on a fresh DB.
func (db *DB) renameOldTables() {
	renames := []struct {
		oldName string
		newName string
	}{
		{"ships", "old_ships"},
		{"vehicles", "old_vehicles"},
		{"hangar_imports", "old_hangar_imports"},
		{"sync_status", "old_sync_status"},
		{"sc_manufacturers", "old_sc_manufacturers"},
		{"sc_vehicles", "old_sc_vehicles"},
		{"sc_items", "old_sc_items"},
		{"sc_ports", "old_sc_ports"},
		{"sc_game_versions", "old_sc_game_versions"},
		{"sc_shipmatrix_vehicles", "old_sc_shipmatrix_vehicles"},
		{"sc_sync_metadata", "old_sc_sync_metadata"},
		{"sc_comm_links", "old_sc_comm_links"},
		{"sc_galactapedia", "old_sc_galactapedia"},
		{"settings", "old_settings"},
		{"ai_analyses", "old_ai_analyses"},
	}

	for _, r := range renames {
		db.conn.Exec(fmt.Sprintf("ALTER TABLE %s RENAME TO %s", r.oldName, r.newName))
	}
}

// dropOldTables removes legacy tables that have been renamed with old_ prefix.
// Called after ensureDefaultUser (which reads old_settings for migration).
// Errors are ignored — tables may not exist on a fresh DB.
func (db *DB) dropOldTables() {
	tables := []string{
		"old_ships",
		"old_vehicles",
		"old_hangar_imports",
		"old_sync_status",
		"old_sc_manufacturers",
		"old_sc_vehicles",
		"old_sc_items",
		"old_sc_ports",
		"old_sc_game_versions",
		"old_sc_shipmatrix_vehicles",
		"old_sc_sync_metadata",
		"old_sc_comm_links",
		"old_sc_galactapedia",
		"old_settings",
		"old_ai_analyses",
	}

	for _, t := range tables {
		db.conn.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", t))
	}
}

// --- Lookup Tables ---

func (db *DB) migrationVehicleTypes() string {
	return `CREATE TABLE IF NOT EXISTS vehicle_types (
		id INTEGER PRIMARY KEY,
		key TEXT UNIQUE NOT NULL,
		label TEXT NOT NULL
	)`
}

func (db *DB) migrationInsuranceTypes() string {
	return `CREATE TABLE IF NOT EXISTS insurance_types (
		id INTEGER PRIMARY KEY,
		key TEXT UNIQUE NOT NULL,
		label TEXT NOT NULL,
		duration_months INTEGER,
		is_lifetime BOOLEAN NOT NULL DEFAULT FALSE
	)`
}

func (db *DB) migrationSyncSources() string {
	return `CREATE TABLE IF NOT EXISTS sync_sources (
		id INTEGER PRIMARY KEY,
		key TEXT UNIQUE NOT NULL,
		label TEXT NOT NULL
	)`
}

func (db *DB) migrationProductionStatuses() string {
	return `CREATE TABLE IF NOT EXISTS production_statuses (
		id INTEGER PRIMARY KEY,
		key TEXT UNIQUE NOT NULL,
		label TEXT NOT NULL
	)`
}

// --- Core Reference Data ---

func (db *DB) migrationManufacturers() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS manufacturers (
		id %s,
		uuid TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		slug TEXT NOT NULL,
		code TEXT,
		known_for TEXT,
		description TEXT,
		logo_url TEXT,
		raw_data TEXT,
		created_at %s DEFAULT CURRENT_TIMESTAMP,
		updated_at %s DEFAULT CURRENT_TIMESTAMP
	)`, db.autoIncrement(), ts, ts)
}

func (db *DB) migrationGameVersions() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS game_versions (
		id %s,
		uuid TEXT UNIQUE NOT NULL,
		code TEXT UNIQUE NOT NULL,
		channel TEXT,
		is_default BOOLEAN DEFAULT FALSE,
		released_at %s,
		created_at %s DEFAULT CURRENT_TIMESTAMP,
		updated_at %s DEFAULT CURRENT_TIMESTAMP
	)`, db.autoIncrement(), ts, ts, ts)
}

func (db *DB) migrationVehicles() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS vehicles (
		id %s,
		uuid TEXT UNIQUE,
		slug TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		class_name TEXT,
		manufacturer_id INTEGER REFERENCES manufacturers(id),
		vehicle_type_id INTEGER REFERENCES vehicle_types(id),
		production_status_id INTEGER REFERENCES production_statuses(id),
		size INTEGER,
		size_label TEXT,
		focus TEXT,
		classification TEXT,
		description TEXT,
		length REAL,
		beam REAL,
		height REAL,
		mass REAL,
		cargo REAL,
		vehicle_inventory REAL,
		crew_min INTEGER,
		crew_max INTEGER,
		speed_scm REAL,
		speed_max REAL,
		health REAL,
		pledge_price REAL,
		price_auec REAL,
		on_sale BOOLEAN DEFAULT FALSE,
		image_url TEXT,
		image_url_small TEXT,
		image_url_medium TEXT,
		image_url_large TEXT,
		pledge_url TEXT,
		game_version_id INTEGER REFERENCES game_versions(id),
		raw_data TEXT,
		created_at %s DEFAULT CURRENT_TIMESTAMP,
		updated_at %s DEFAULT CURRENT_TIMESTAMP
	)`, db.autoIncrement(), ts, ts)
}

func (db *DB) migrationPorts() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS ports (
		id %s,
		uuid TEXT UNIQUE NOT NULL,
		vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
		parent_port_id INTEGER REFERENCES ports(id),
		name TEXT NOT NULL,
		position TEXT,
		category_label TEXT,
		size_min INTEGER,
		size_max INTEGER,
		port_type TEXT,
		port_subtype TEXT,
		equipped_item_uuid TEXT,
		editable BOOLEAN DEFAULT TRUE,
		health REAL,
		created_at %s DEFAULT CURRENT_TIMESTAMP
	)`, db.autoIncrement(), ts)
}

func (db *DB) migrationComponents() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS components (
		id %s,
		uuid TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		slug TEXT,
		class_name TEXT,
		manufacturer_id INTEGER REFERENCES manufacturers(id),
		type TEXT NOT NULL,
		sub_type TEXT,
		size INTEGER,
		grade TEXT,
		description TEXT,
		game_version_id INTEGER REFERENCES game_versions(id),
		raw_data TEXT,
		created_at %s DEFAULT CURRENT_TIMESTAMP,
		updated_at %s DEFAULT CURRENT_TIMESTAMP
	)`, db.autoIncrement(), ts, ts)
}

func (db *DB) migrationFPSWeapons() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS fps_weapons (
		id %s,
		uuid TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		slug TEXT,
		class_name TEXT,
		manufacturer_id INTEGER REFERENCES manufacturers(id),
		sub_type TEXT,
		size INTEGER,
		description TEXT,
		game_version_id INTEGER REFERENCES game_versions(id),
		raw_data TEXT,
		created_at %s DEFAULT CURRENT_TIMESTAMP,
		updated_at %s DEFAULT CURRENT_TIMESTAMP
	)`, db.autoIncrement(), ts, ts)
}

func (db *DB) migrationFPSArmour() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS fps_armour (
		id %s,
		uuid TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		slug TEXT,
		class_name TEXT,
		manufacturer_id INTEGER REFERENCES manufacturers(id),
		sub_type TEXT,
		size INTEGER,
		grade TEXT,
		description TEXT,
		game_version_id INTEGER REFERENCES game_versions(id),
		raw_data TEXT,
		created_at %s DEFAULT CURRENT_TIMESTAMP,
		updated_at %s DEFAULT CURRENT_TIMESTAMP
	)`, db.autoIncrement(), ts, ts)
}

func (db *DB) migrationFPSAttachments() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS fps_attachments (
		id %s,
		uuid TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		slug TEXT,
		class_name TEXT,
		manufacturer_id INTEGER REFERENCES manufacturers(id),
		sub_type TEXT,
		size INTEGER,
		description TEXT,
		game_version_id INTEGER REFERENCES game_versions(id),
		raw_data TEXT,
		created_at %s DEFAULT CURRENT_TIMESTAMP,
		updated_at %s DEFAULT CURRENT_TIMESTAMP
	)`, db.autoIncrement(), ts, ts)
}

func (db *DB) migrationFPSAmmo() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS fps_ammo (
		id %s,
		uuid TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		slug TEXT,
		class_name TEXT,
		manufacturer_id INTEGER REFERENCES manufacturers(id),
		sub_type TEXT,
		description TEXT,
		game_version_id INTEGER REFERENCES game_versions(id),
		raw_data TEXT,
		created_at %s DEFAULT CURRENT_TIMESTAMP,
		updated_at %s DEFAULT CURRENT_TIMESTAMP
	)`, db.autoIncrement(), ts, ts)
}

func (db *DB) migrationFPSUtilities() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS fps_utilities (
		id %s,
		uuid TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		slug TEXT,
		class_name TEXT,
		manufacturer_id INTEGER REFERENCES manufacturers(id),
		sub_type TEXT,
		description TEXT,
		game_version_id INTEGER REFERENCES game_versions(id),
		raw_data TEXT,
		created_at %s DEFAULT CURRENT_TIMESTAMP,
		updated_at %s DEFAULT CURRENT_TIMESTAMP
	)`, db.autoIncrement(), ts, ts)
}

func (db *DB) migrationPaints() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS paints (
		id %s,
		uuid TEXT UNIQUE,
		name TEXT NOT NULL,
		slug TEXT,
		class_name TEXT UNIQUE,
		description TEXT,
		image_url TEXT,
		image_url_small TEXT,
		image_url_medium TEXT,
		image_url_large TEXT,
		raw_data TEXT,
		created_at %s DEFAULT CURRENT_TIMESTAMP,
		updated_at %s DEFAULT CURRENT_TIMESTAMP
	)`, db.autoIncrement(), ts, ts)
}

func (db *DB) migrationPaintVehicles() string {
	return `CREATE TABLE IF NOT EXISTS paint_vehicles (
		paint_id INTEGER NOT NULL REFERENCES paints(id),
		vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
		PRIMARY KEY (paint_id, vehicle_id)
	)`
}

func (db *DB) migrationVehicleLoaners() string {
	return `CREATE TABLE IF NOT EXISTS vehicle_loaners (
		vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
		loaner_id INTEGER NOT NULL REFERENCES vehicles(id),
		PRIMARY KEY (vehicle_id, loaner_id)
	)`
}

// --- User Data ---

func (db *DB) migrationUsers() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS users (
		id %s,
		username TEXT UNIQUE NOT NULL,
		handle TEXT,
		email TEXT,
		created_at %s DEFAULT CURRENT_TIMESTAMP,
		updated_at %s DEFAULT CURRENT_TIMESTAMP
	)`, db.autoIncrement(), ts, ts)
}

func (db *DB) migrationUserFleet() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS user_fleet (
		id %s,
		user_id INTEGER NOT NULL REFERENCES users(id),
		vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
		insurance_type_id INTEGER REFERENCES insurance_types(id),
		warbond BOOLEAN NOT NULL DEFAULT FALSE,
		is_loaner BOOLEAN NOT NULL DEFAULT FALSE,
		pledge_id TEXT,
		pledge_name TEXT,
		pledge_cost TEXT,
		pledge_date TEXT,
		custom_name TEXT,
		equipped_paint_id INTEGER REFERENCES paints(id),
		imported_at %s DEFAULT CURRENT_TIMESTAMP
	)`, db.autoIncrement(), ts)
}

func (db *DB) migrationUserPaints() string {
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS user_paints (
		id %s,
		user_id INTEGER NOT NULL REFERENCES users(id),
		paint_id INTEGER NOT NULL REFERENCES paints(id),
		UNIQUE(user_id, paint_id)
	)`, db.autoIncrement())
}

func (db *DB) migrationUserLLMConfigs() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS user_llm_configs (
		id %s,
		user_id INTEGER NOT NULL REFERENCES users(id),
		provider TEXT NOT NULL,
		encrypted_api_key TEXT NOT NULL,
		model TEXT,
		created_at %s DEFAULT CURRENT_TIMESTAMP,
		updated_at %s DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(user_id, provider)
	)`, db.autoIncrement(), ts, ts)
}

func (db *DB) migrationUserSettings() string {
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS user_settings (
		id %s,
		user_id INTEGER NOT NULL REFERENCES users(id),
		key TEXT NOT NULL,
		value TEXT NOT NULL,
		UNIQUE(user_id, key)
	)`, db.autoIncrement())
}

// --- Sync & Audit ---

func (db *DB) migrationSyncHistory() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS sync_history (
		id %s,
		source_id INTEGER NOT NULL REFERENCES sync_sources(id),
		endpoint TEXT,
		status TEXT NOT NULL,
		record_count INTEGER DEFAULT 0,
		error_message TEXT,
		started_at %s DEFAULT CURRENT_TIMESTAMP,
		completed_at %s
	)`, db.autoIncrement(), ts, ts)
}

func (db *DB) migrationAIAnalyses() string {
	ts := db.timestampType()
	return fmt.Sprintf(`CREATE TABLE IF NOT EXISTS ai_analyses (
		id %s,
		user_id INTEGER NOT NULL REFERENCES users(id),
		provider TEXT NOT NULL,
		model TEXT NOT NULL,
		vehicle_count INTEGER NOT NULL,
		analysis TEXT NOT NULL,
		created_at %s NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`, db.autoIncrement(), ts)
}

func (db *DB) migrationAppSettings() string {
	return `CREATE TABLE IF NOT EXISTS app_settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	)`
}

// migratePaintsAddColumns is a no-op — all columns are now in the base CREATE TABLE.
// Retained for call-site compatibility.
func (db *DB) migratePaintsAddColumns() {}

// --- Seed Data ---

func (db *DB) seedLookupTables() {
	// Vehicle types
	vehicleTypes := []struct {
		id    int
		key   string
		label string
	}{
		{1, "spaceship", "Spaceship"},
		{2, "ground_vehicle", "Ground Vehicle"},
		{3, "gravlev", "Gravlev"},
	}
	vtQuery := db.prepareQuery(db.insertIgnore("vehicle_types", "id, key, label", "id", 3))
	for _, vt := range vehicleTypes {
		db.conn.Exec(vtQuery, vt.id, vt.key, vt.label)
	}

	// Insurance types
	insuranceTypes := []struct {
		id             int
		key            string
		label          string
		durationMonths *int
		isLifetime     bool
	}{
		{1, "lti", "Lifetime Insurance", nil, true},
		{2, "120_month", "120-Month Insurance", intPtr(120), false},
		{3, "72_month", "72-Month Insurance", intPtr(72), false},
		{4, "6_month", "6-Month Insurance", intPtr(6), false},
		{5, "3_month", "3-Month Insurance", intPtr(3), false},
		{6, "standard", "Standard Insurance", nil, false},
		{7, "unknown", "Unknown Insurance", nil, false},
	}
	itQuery := db.prepareQuery(db.insertIgnore("insurance_types", "id, key, label, duration_months, is_lifetime", "id", 5))
	for _, it := range insuranceTypes {
		db.conn.Exec(itQuery, it.id, it.key, it.label, it.durationMonths, it.isLifetime)
	}

	// Sync sources
	syncSources := []struct {
		id    int
		key   string
		label string
	}{
		{1, "scwiki", "SC Wiki API"},
		{2, "fleetyards", "FleetYards (Images Only)"},
		{3, "hangarxplor", "HangarXplor"},
		{4, "scunpacked", "scunpacked-data (Paints)"},
		{5, "rsi_api", "RSI API (Images)"},
	}
	ssQuery := db.prepareQuery(db.insertIgnore("sync_sources", "id, key, label", "id", 3))
	for _, ss := range syncSources {
		db.conn.Exec(ssQuery, ss.id, ss.key, ss.label)
	}

	// Production statuses
	productionStatuses := []struct {
		id    int
		key   string
		label string
	}{
		{1, "flight_ready", "Flight Ready"},
		{2, "in_production", "In Production"},
		{3, "in_concept", "In Concept"},
		{4, "unknown", "Unknown"},
	}
	psQuery := db.prepareQuery(db.insertIgnore("production_statuses", "id, key, label", "id", 3))
	for _, ps := range productionStatuses {
		db.conn.Exec(psQuery, ps.id, ps.key, ps.label)
	}
}

func (db *DB) ensureDefaultUser() {
	var count int
	db.conn.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if count == 0 {
		db.conn.Exec(
			"INSERT INTO users (username, handle) VALUES (?, ?)",
			"default", "",
		)
		log.Info().Msg("created default user")
	}
}

func intPtr(n int) *int {
	return &n
}
