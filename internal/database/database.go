package database

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	"github.com/nzvengeance/fleet-manager/internal/config"
	"github.com/nzvengeance/fleet-manager/internal/models"
	"github.com/rs/zerolog/log"

	_ "github.com/jackc/pgx/v5/stdlib"
	_ "github.com/mattn/go-sqlite3"
)

// DB provides the data access layer
type DB struct {
	conn   *sql.DB
	driver string
}

// New creates a new database connection based on config
func New(cfg *config.Config) (*DB, error) {
	var conn *sql.DB
	var err error

	switch cfg.DBDriver {
	case "sqlite":
		// Ensure directory exists
		dir := filepath.Dir(cfg.DBPath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("creating db directory: %w", err)
		}
		conn, err = sql.Open("sqlite3", cfg.DBPath+"?_journal_mode=WAL&_foreign_keys=on")
		if err != nil {
			return nil, fmt.Errorf("opening sqlite: %w", err)
		}
		// SQLite tuning
		conn.SetMaxOpenConns(1) // SQLite is single-writer
	case "postgres":
		if cfg.DBURL == "" {
			return nil, fmt.Errorf("DATABASE_URL required for postgres driver")
		}
		conn, err = sql.Open("pgx", cfg.DBURL)
		if err != nil {
			return nil, fmt.Errorf("opening postgres: %w", err)
		}
		conn.SetMaxOpenConns(10)
	default:
		return nil, fmt.Errorf("unsupported database driver: %s", cfg.DBDriver)
	}

	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("pinging database: %w", err)
	}

	db := &DB{conn: conn, driver: cfg.DBDriver}

	if err := db.migrate(); err != nil {
		return nil, fmt.Errorf("running migrations: %w", err)
	}

	log.Info().Str("driver", cfg.DBDriver).Msg("database connected")
	return db, nil
}

// Close closes the database connection
func (db *DB) Close() error {
	return db.conn.Close()
}

// RawConn returns the underlying sql.DB connection
func (db *DB) RawConn() *sql.DB {
	return db.conn
}

// placeholder returns the correct placeholder syntax for the driver
func (db *DB) placeholder(n int) string {
	if db.driver == "postgres" {
		return fmt.Sprintf("$%d", n)
	}
	return "?"
}

// autoIncrement returns the correct auto-increment syntax
func (db *DB) autoIncrement() string {
	if db.driver == "postgres" {
		return "SERIAL PRIMARY KEY"
	}
	return "INTEGER PRIMARY KEY AUTOINCREMENT"
}

// onConflict returns the correct upsert syntax
func (db *DB) onConflictUpdate(conflictCol, updateCols string) string {
	if db.driver == "postgres" {
		return fmt.Sprintf("ON CONFLICT (%s) DO UPDATE SET %s", conflictCol, updateCols)
	}
	return fmt.Sprintf("ON CONFLICT(%s) DO UPDATE SET %s", conflictCol, updateCols)
}

// timestampType returns the correct timestamp type
func (db *DB) timestampType() string {
	if db.driver == "postgres" {
		return "TIMESTAMPTZ"
	}
	return "DATETIME"
}

// now returns the correct current timestamp function
func (db *DB) now() string {
	if db.driver == "postgres" {
		return "NOW()"
	}
	return "datetime('now')"
}

// --- Ship Operations ---

func (db *DB) UpsertShip(ctx context.Context, ship *models.Ship) error {
	query := fmt.Sprintf(`
		INSERT INTO ships (slug, name, sc_identifier, manufacturer_name, manufacturer_code,
			focus, size_label, length, beam, height, mass, cargo, min_crew, max_crew,
			scm_speed, pledge_price, on_sale, production_status, description, classification,
			image_url, image_url_small, image_url_medium, image_url_large,
			fleetyards_url, last_synced_at, raw_json)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, %s, ?)
		%s`,
		db.now(),
		db.onConflictUpdate("slug", `
			name=excluded.name, sc_identifier=excluded.sc_identifier,
			manufacturer_name=excluded.manufacturer_name, manufacturer_code=excluded.manufacturer_code,
			focus=excluded.focus, size_label=excluded.size_label,
			length=excluded.length, beam=excluded.beam, height=excluded.height, mass=excluded.mass,
			cargo=excluded.cargo, min_crew=excluded.min_crew, max_crew=excluded.max_crew,
			scm_speed=excluded.scm_speed, pledge_price=excluded.pledge_price, on_sale=excluded.on_sale,
			production_status=excluded.production_status, description=excluded.description,
			classification=excluded.classification, image_url=excluded.image_url,
			image_url_small=excluded.image_url_small, image_url_medium=excluded.image_url_medium,
			image_url_large=excluded.image_url_large, fleetyards_url=excluded.fleetyards_url,
			last_synced_at=excluded.last_synced_at, raw_json=excluded.raw_json`),
	)

	if db.driver == "postgres" {
		query = replacePlaceholders(query)
	}

	_, err := db.conn.ExecContext(ctx, query,
		ship.Slug, ship.Name, ship.SCIdentifier, ship.ManufacturerName, ship.ManufacturerCode,
		ship.Focus, ship.SizeLabel, ship.Length, ship.Beam, ship.Height, ship.Mass,
		ship.Cargo, ship.MinCrew, ship.MaxCrew, ship.SCMSpeed, ship.PledgePrice, ship.OnSale,
		ship.ProductionStatus, ship.Description, ship.Classification,
		ship.ImageURL, ship.ImageURLSmall, ship.ImageURLMedium, ship.ImageURLLarge,
		ship.FleetYardsURL, ship.RawJSON,
	)
	return err
}

func (db *DB) GetAllShips(ctx context.Context) ([]models.Ship, error) {
	rows, err := db.conn.QueryContext(ctx, `
		SELECT id, slug, name, sc_identifier, manufacturer_name, manufacturer_code,
			focus, size_label, length, beam, height, mass, cargo, min_crew, max_crew,
			scm_speed, pledge_price, on_sale, production_status, description, classification,
			image_url, image_url_small, image_url_medium, image_url_large,
			fleetyards_url, last_synced_at
		FROM ships ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ships []models.Ship
	for rows.Next() {
		var s models.Ship
		err := rows.Scan(&s.ID, &s.Slug, &s.Name, &s.SCIdentifier, &s.ManufacturerName,
			&s.ManufacturerCode, &s.Focus, &s.SizeLabel, &s.Length, &s.Beam, &s.Height,
			&s.Mass, &s.Cargo, &s.MinCrew, &s.MaxCrew, &s.SCMSpeed, &s.PledgePrice, &s.OnSale,
			&s.ProductionStatus, &s.Description, &s.Classification, &s.ImageURL,
			&s.ImageURLSmall, &s.ImageURLMedium, &s.ImageURLLarge,
			&s.FleetYardsURL, &s.LastSyncedAt)
		if err != nil {
			return nil, err
		}
		ships = append(ships, s)
	}
	return ships, nil
}

func (db *DB) GetShipBySlug(ctx context.Context, slug string) (*models.Ship, error) {
	query := "SELECT id, slug, name, sc_identifier, manufacturer_name, manufacturer_code, focus, size_label, length, beam, height, mass, cargo, min_crew, max_crew, scm_speed, pledge_price, on_sale, production_status, description, classification, image_url, image_url_small, image_url_medium, image_url_large, fleetyards_url, last_synced_at FROM ships WHERE slug = ?"
	if db.driver == "postgres" {
		query = replacePlaceholders(query)
	}

	var s models.Ship
	err := db.conn.QueryRowContext(ctx, query, slug).Scan(
		&s.ID, &s.Slug, &s.Name, &s.SCIdentifier, &s.ManufacturerName,
		&s.ManufacturerCode, &s.Focus, &s.SizeLabel, &s.Length, &s.Beam, &s.Height,
		&s.Mass, &s.Cargo, &s.MinCrew, &s.MaxCrew, &s.SCMSpeed, &s.PledgePrice, &s.OnSale,
		&s.ProductionStatus, &s.Description, &s.Classification, &s.ImageURL,
		&s.ImageURLSmall, &s.ImageURLMedium, &s.ImageURLLarge,
		&s.FleetYardsURL, &s.LastSyncedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &s, err
}

func (db *DB) GetShipCount(ctx context.Context) (int, error) {
	var count int
	err := db.conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM ships").Scan(&count)
	return count, err
}

// --- Vehicle Operations ---

// InsertVehicle inserts a vehicle and returns its ID.
// Always use after ClearAllVehicles for clean-slate imports.
func (db *DB) InsertVehicle(ctx context.Context, v *models.Vehicle) (int, error) {
	query := fmt.Sprintf(`
		INSERT INTO vehicles (ship_slug, ship_name, custom_name, manufacturer_name, manufacturer_code,
			flagship, public, loaner, paint_name, source, last_synced_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, %s)`,
		db.now(),
	)

	if db.driver == "postgres" {
		query = replacePlaceholders(query)
		query += " RETURNING id"
		var id int
		err := db.conn.QueryRowContext(ctx, query,
			v.ShipSlug, v.ShipName, v.CustomName, v.ManufacturerName, v.ManufacturerCode,
			v.Flagship, v.Public, v.Loaner, v.PaintName, v.Source,
		).Scan(&id)
		return id, err
	}

	res, err := db.conn.ExecContext(ctx, query,
		v.ShipSlug, v.ShipName, v.CustomName, v.ManufacturerName, v.ManufacturerCode,
		v.Flagship, v.Public, v.Loaner, v.PaintName, v.Source,
	)
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	return int(id), err
}

func (db *DB) GetAllVehicles(ctx context.Context) ([]models.Vehicle, error) {
	rows, err := db.conn.QueryContext(ctx, `
		SELECT v.id, v.ship_slug, v.ship_name, v.custom_name, v.manufacturer_name,
			v.manufacturer_code, v.flagship, v.public, v.loaner, v.paint_name,
			v.source, v.last_synced_at,
			s.focus, s.size_label, s.cargo, s.min_crew, s.max_crew, s.pledge_price,
			s.production_status, s.scm_speed, s.image_url
		FROM vehicles v
		LEFT JOIN ships s ON v.ship_slug = s.slug
		ORDER BY v.ship_name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vehicles []models.Vehicle
	for rows.Next() {
		var v models.Vehicle
		var focus, sizeLabel, prodStatus, imageURL sql.NullString
		var cargo, scmSpeed, pledgePrice sql.NullFloat64
		var minCrew, maxCrew sql.NullInt64

		err := rows.Scan(&v.ID, &v.ShipSlug, &v.ShipName, &v.CustomName,
			&v.ManufacturerName, &v.ManufacturerCode, &v.Flagship, &v.Public,
			&v.Loaner, &v.PaintName,
			&v.Source, &v.LastSyncedAt,
			&focus, &sizeLabel, &cargo, &minCrew, &maxCrew, &pledgePrice,
			&prodStatus, &scmSpeed, &imageURL)
		if err != nil {
			return nil, err
		}

		if focus.Valid {
			v.Ship = &models.Ship{
				Focus:            focus.String,
				SizeLabel:        sizeLabel.String,
				Cargo:            cargo.Float64,
				MinCrew:          int(minCrew.Int64),
				MaxCrew:          int(maxCrew.Int64),
				PledgePrice:      pledgePrice.Float64,
				ProductionStatus: prodStatus.String,
				SCMSpeed:         scmSpeed.Float64,
				ImageURL:         imageURL.String,
			}
		}

		vehicles = append(vehicles, v)
	}
	return vehicles, nil
}

func (db *DB) GetVehicleCount(ctx context.Context) (int, error) {
	var count int
	err := db.conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM vehicles").Scan(&count)
	return count, err
}

func (db *DB) ClearVehiclesBySource(ctx context.Context, source string) error {
	query := "DELETE FROM vehicles WHERE source = ?"
	if db.driver == "postgres" {
		query = replacePlaceholders(query)
	}
	_, err := db.conn.ExecContext(ctx, query, source)
	return err
}

func (db *DB) ClearAllVehicles(ctx context.Context) error {
	_, err := db.conn.ExecContext(ctx, "DELETE FROM vehicles")
	return err
}

// EnrichVehicle updates a vehicle with supplementary FleetYards data
func (db *DB) EnrichVehicle(ctx context.Context, vehicleID int, canonicalSlug string, loaner bool, paintName string) error {
	query := "UPDATE vehicles SET ship_slug = ?, loaner = ?, paint_name = ? WHERE id = ?"
	if db.driver == "postgres" {
		query = replacePlaceholders(query)
	}
	_, err := db.conn.ExecContext(ctx, query, canonicalSlug, loaner, paintName, vehicleID)
	return err
}

// --- Settings Operations ---

func (db *DB) GetSetting(ctx context.Context, key string) (string, error) {
	query := "SELECT value FROM settings WHERE key = ?"
	if db.driver == "postgres" {
		query = replacePlaceholders(query)
	}
	var value string
	err := db.conn.QueryRowContext(ctx, query, key).Scan(&value)
	if err != nil {
		return "", nil // Key not found = empty
	}
	return value, nil
}

func (db *DB) SetSetting(ctx context.Context, key, value string) error {
	query := "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
	if db.driver == "postgres" {
		query = replacePlaceholders(query)
	}
	_, err := db.conn.ExecContext(ctx, query, key, value)
	return err
}

// --- Hangar Import Operations ---

func (db *DB) UpsertHangarImport(ctx context.Context, h *models.HangarImportDetail) error {
	query := fmt.Sprintf(`
		INSERT INTO hangar_imports (vehicle_id, ship_slug, ship_code, lti, warbond, pledge_id,
			pledge_name, pledge_date, pledge_cost, entity_type, imported_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, %s)
		%s`,
		db.now(),
		db.onConflictUpdate("pledge_id",
			"vehicle_id=excluded.vehicle_id, ship_slug=excluded.ship_slug, ship_code=excluded.ship_code, lti=excluded.lti, warbond=excluded.warbond, pledge_name=excluded.pledge_name, pledge_date=excluded.pledge_date, pledge_cost=excluded.pledge_cost, entity_type=excluded.entity_type, imported_at=excluded.imported_at"),
	)

	if db.driver == "postgres" {
		query = replacePlaceholders(query)
	}

	_, err := db.conn.ExecContext(ctx, query,
		h.VehicleID, h.ShipSlug, h.ShipCode, h.LTI, h.Warbond, h.PledgeID,
		h.PledgeName, h.PledgeDate, h.PledgeCost, h.EntityType,
	)
	return err
}

func (db *DB) GetHangarImports(ctx context.Context) ([]models.HangarImportDetail, error) {
	rows, err := db.conn.QueryContext(ctx, `
		SELECT id, vehicle_id, ship_slug, ship_code, lti, warbond, pledge_id,
			pledge_name, pledge_date, pledge_cost, entity_type, imported_at
		FROM hangar_imports ORDER BY imported_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var imports []models.HangarImportDetail
	for rows.Next() {
		var h models.HangarImportDetail
		err := rows.Scan(&h.ID, &h.VehicleID, &h.ShipSlug, &h.ShipCode, &h.LTI, &h.Warbond,
			&h.PledgeID, &h.PledgeName, &h.PledgeDate, &h.PledgeCost, &h.EntityType,
			&h.ImportedAt)
		if err != nil {
			return nil, err
		}
		imports = append(imports, h)
	}
	return imports, nil
}

func (db *DB) ClearHangarImports(ctx context.Context) error {
	_, err := db.conn.ExecContext(ctx, "DELETE FROM hangar_imports")
	return err
}

// --- Sync Status Operations ---

func (db *DB) InsertSyncStatus(ctx context.Context, s *models.SyncStatus) (int, error) {
	query := fmt.Sprintf(`INSERT INTO sync_status (sync_type, status, item_count, error_message, started_at) VALUES (?, ?, ?, ?, %s)`, db.now())
	if db.driver == "postgres" {
		query = replacePlaceholders(query)
		query += " RETURNING id"
		var id int
		err := db.conn.QueryRowContext(ctx, query, s.SyncType, s.Status, s.ItemCount, s.ErrorMessage).Scan(&id)
		return id, err
	}

	result, err := db.conn.ExecContext(ctx, query, s.SyncType, s.Status, s.ItemCount, s.ErrorMessage)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	return int(id), err
}

func (db *DB) UpdateSyncStatus(ctx context.Context, id int, status string, count int, errMsg string) error {
	query := fmt.Sprintf("UPDATE sync_status SET status = ?, item_count = ?, error_message = ?, completed_at = %s WHERE id = ?", db.now())
	if db.driver == "postgres" {
		query = replacePlaceholders(query)
	}
	_, err := db.conn.ExecContext(ctx, query, status, count, errMsg, id)
	return err
}

func (db *DB) GetLatestSyncStatus(ctx context.Context) ([]models.SyncStatus, error) {
	rows, err := db.conn.QueryContext(ctx, `
		SELECT id, sync_type, status, item_count, error_message, started_at, completed_at
		FROM sync_status ORDER BY started_at DESC LIMIT 10`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var statuses []models.SyncStatus
	for rows.Next() {
		var s models.SyncStatus
		var completedAt sql.NullTime
		err := rows.Scan(&s.ID, &s.SyncType, &s.Status, &s.ItemCount, &s.ErrorMessage,
			&s.StartedAt, &completedAt)
		if err != nil {
			return nil, err
		}
		if completedAt.Valid {
			s.CompletedAt = completedAt.Time
		}
		statuses = append(statuses, s)
	}
	return statuses, nil
}

// --- Helpers ---

// GetVehicleIDBySlug returns the ID of a vehicle matching the given slug (any source)
func (db *DB) GetVehicleIDBySlug(ctx context.Context, slug string) (int, error) {
	query := "SELECT id FROM vehicles WHERE ship_slug = ? LIMIT 1"
	if db.driver == "postgres" {
		query = replacePlaceholders(query)
	}
	var id int
	err := db.conn.QueryRowContext(ctx, query, slug).Scan(&id)
	if err != nil {
		return 0, err
	}
	return id, nil
}

// FindShipSlug tries to find a matching ship in the reference DB.
// Tries: exact slug match, then name LIKE match, then partial slug match.
// Returns the matched slug or empty string if no match found.
func (db *DB) FindShipSlug(ctx context.Context, candidateSlugs []string, displayName string) string {
	// 1. Try exact slug match for each candidate
	for _, slug := range candidateSlugs {
		if slug == "" {
			continue
		}
		query := "SELECT slug FROM ships WHERE slug = ? LIMIT 1"
		if db.driver == "postgres" {
			query = replacePlaceholders(query)
		}
		var found string
		if err := db.conn.QueryRowContext(ctx, query, slug).Scan(&found); err == nil {
			return found
		}
	}

	// 2. Try LIKE match on ship name
	if displayName != "" {
		query := "SELECT slug FROM ships WHERE LOWER(name) = LOWER(?) LIMIT 1"
		if db.driver == "postgres" {
			query = replacePlaceholders(query)
		}
		var found string
		if err := db.conn.QueryRowContext(ctx, query, displayName).Scan(&found); err == nil {
			return found
		}
	}

	// 3. Try partial slug match (slug contains candidate)
	for _, slug := range candidateSlugs {
		if slug == "" || len(slug) < 3 {
			continue
		}
		query := "SELECT slug FROM ships WHERE slug LIKE ? LIMIT 1"
		if db.driver == "postgres" {
			query = replacePlaceholders(query)
		}
		var found string
		pattern := slug + "%"
		if err := db.conn.QueryRowContext(ctx, query, pattern).Scan(&found); err == nil {
			return found
		}
	}

	return ""
}

// GetVehiclesWithInsurance returns vehicles joined with their hangar import data via SQL
func (db *DB) GetVehiclesWithInsurance(ctx context.Context) ([]models.Vehicle, error) {
	rows, err := db.conn.QueryContext(ctx, `
		SELECT v.id, v.ship_slug, v.ship_name, v.custom_name, v.manufacturer_name,
			v.manufacturer_code, v.flagship, v.public, v.loaner, v.paint_name,
			v.source, v.last_synced_at,
			s.focus, s.size_label, s.cargo, s.min_crew, s.max_crew, s.pledge_price,
			s.production_status, s.scm_speed, s.image_url,
			hi.id, hi.lti, hi.warbond, hi.pledge_id, hi.pledge_name,
			hi.pledge_date, hi.pledge_cost, hi.entity_type
		FROM vehicles v
		LEFT JOIN ships s ON v.ship_slug = s.slug
		LEFT JOIN hangar_imports hi ON hi.vehicle_id = v.id
		ORDER BY v.ship_name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vehicles []models.Vehicle
	for rows.Next() {
		var v models.Vehicle
		var focus, sizeLabel, prodStatus, imageURL sql.NullString
		var cargo, scmSpeed, pledgePrice sql.NullFloat64
		var minCrew, maxCrew sql.NullInt64
		// hangar_import nullable fields
		var hiID sql.NullInt64
		var hiLTI, hiWarbond sql.NullBool
		var hiPledgeID, hiPledgeName, hiPledgeDate, hiPledgeCost, hiEntityType sql.NullString

		err := rows.Scan(&v.ID, &v.ShipSlug, &v.ShipName, &v.CustomName,
			&v.ManufacturerName, &v.ManufacturerCode, &v.Flagship, &v.Public,
			&v.Loaner, &v.PaintName,
			&v.Source, &v.LastSyncedAt,
			&focus, &sizeLabel, &cargo, &minCrew, &maxCrew, &pledgePrice,
			&prodStatus, &scmSpeed, &imageURL,
			&hiID, &hiLTI, &hiWarbond, &hiPledgeID, &hiPledgeName,
			&hiPledgeDate, &hiPledgeCost, &hiEntityType)
		if err != nil {
			return nil, err
		}

		if focus.Valid {
			v.Ship = &models.Ship{
				Focus:            focus.String,
				SizeLabel:        sizeLabel.String,
				Cargo:            cargo.Float64,
				MinCrew:          int(minCrew.Int64),
				MaxCrew:          int(maxCrew.Int64),
				PledgePrice:      pledgePrice.Float64,
				ProductionStatus: prodStatus.String,
				SCMSpeed:         scmSpeed.Float64,
				ImageURL:         imageURL.String,
			}
		}

		if hiID.Valid {
			v.HangarImport = &models.HangarImportDetail{
				ID:         int(hiID.Int64),
				LTI:        hiLTI.Bool,
				Warbond:    hiWarbond.Bool,
				PledgeID:   hiPledgeID.String,
				PledgeName: hiPledgeName.String,
				PledgeDate: hiPledgeDate.String,
				PledgeCost: hiPledgeCost.String,
				EntityType: hiEntityType.String,
			}
		}

		vehicles = append(vehicles, v)
	}
	return vehicles, nil
}

// RawQuery executes a raw query and returns rows (for diagnostics)
func (db *DB) RawQuery(ctx context.Context, query string) (*sql.Rows, error) {
	return db.conn.QueryContext(ctx, query)
}

// RawQueryRow executes a raw query and returns a single row (for diagnostics)
func (db *DB) RawQueryRow(ctx context.Context, query string) *sql.Row {
	return db.conn.QueryRowContext(ctx, query)
}

// replacePlaceholders converts ? to $1, $2, etc. for PostgreSQL
func replacePlaceholders(query string) string {
	result := make([]byte, 0, len(query)+10)
	n := 1
	for i := 0; i < len(query); i++ {
		if query[i] == '?' {
			result = append(result, '$')
			result = append(result, []byte(fmt.Sprintf("%d", n))...)
			n++
		} else {
			result = append(result, query[i])
		}
	}
	return string(result)
}

// SaveAIAnalysis stores a new AI fleet analysis
func (db *DB) SaveAIAnalysis(ctx context.Context, provider, model string, vehicleCount int, analysis string) (int64, error) {
	query := `INSERT INTO ai_analyses (provider, model, vehicle_count, analysis) VALUES (?, ?, ?, ?)`
	if db.driver == "postgres" {
		query = replacePlaceholders(query)
	}

	result, err := db.conn.ExecContext(ctx, query, provider, model, vehicleCount, analysis)
	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

// GetLatestAIAnalysis retrieves the most recent AI analysis
func (db *DB) GetLatestAIAnalysis(ctx context.Context) (*models.AIAnalysis, error) {
	query := `SELECT id, created_at, provider, model, vehicle_count, analysis FROM ai_analyses ORDER BY created_at DESC LIMIT 1`

	var a models.AIAnalysis
	err := db.conn.QueryRowContext(ctx, query).Scan(&a.ID, &a.CreatedAt, &a.Provider, &a.Model, &a.VehicleCount, &a.Analysis)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &a, nil
}

// GetAIAnalysisHistory retrieves all AI analyses, newest first
func (db *DB) GetAIAnalysisHistory(ctx context.Context, limit int) ([]models.AIAnalysis, error) {
	if limit == 0 {
		limit = 50
	}

	query := fmt.Sprintf(`SELECT id, created_at, provider, model, vehicle_count, analysis FROM ai_analyses ORDER BY created_at DESC LIMIT %d`, limit)

	rows, err := db.conn.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var analyses []models.AIAnalysis
	for rows.Next() {
		var a models.AIAnalysis
		if err := rows.Scan(&a.ID, &a.CreatedAt, &a.Provider, &a.Model, &a.VehicleCount, &a.Analysis); err != nil {
			return nil, err
		}
		analyses = append(analyses, a)
	}

	return analyses, rows.Err()
}

// DeleteAIAnalysis deletes a specific AI analysis by ID
func (db *DB) DeleteAIAnalysis(ctx context.Context, id int64) error {
	query := `DELETE FROM ai_analyses WHERE id = ?`
	if db.driver == "postgres" {
		query = replacePlaceholders(query)
	}

	_, err := db.conn.ExecContext(ctx, query, id)
	return err
}
