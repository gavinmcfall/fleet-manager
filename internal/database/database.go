package database

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

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
		dir := filepath.Dir(cfg.DBPath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("creating db directory: %w", err)
		}
		conn, err = sql.Open("sqlite3", cfg.DBPath+"?_journal_mode=WAL&_foreign_keys=on")
		if err != nil {
			return nil, fmt.Errorf("opening sqlite: %w", err)
		}
		conn.SetMaxOpenConns(1)
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

func (db *DB) Close() error {
	return db.conn.Close()
}

func (db *DB) RawConn() *sql.DB {
	return db.conn
}

func (db *DB) Driver() string {
	return db.driver
}

// --- SQL Helpers ---

func (db *DB) placeholder(n int) string {
	if db.driver == "postgres" {
		return fmt.Sprintf("$%d", n)
	}
	return "?"
}

func (db *DB) autoIncrement() string {
	if db.driver == "postgres" {
		return "SERIAL PRIMARY KEY"
	}
	return "INTEGER PRIMARY KEY AUTOINCREMENT"
}

func (db *DB) insertIgnore(table, cols, conflictCol string, numParams int) string {
	ph := db.placeholders(numParams)
	if db.driver == "postgres" {
		return fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s) ON CONFLICT (%s) DO NOTHING", table, cols, ph, conflictCol)
	}
	return fmt.Sprintf("INSERT OR IGNORE INTO %s (%s) VALUES (%s)", table, cols, ph)
}

func (db *DB) placeholders(n int) string {
	parts := make([]string, n)
	for i := range parts {
		parts[i] = "?"
	}
	return strings.Join(parts, ", ")
}

func (db *DB) onConflictUpdate(conflictCol, updateCols string) string {
	if db.driver == "postgres" {
		return fmt.Sprintf("ON CONFLICT (%s) DO UPDATE SET %s", conflictCol, updateCols)
	}
	return fmt.Sprintf("ON CONFLICT(%s) DO UPDATE SET %s", conflictCol, updateCols)
}

func (db *DB) timestampType() string {
	if db.driver == "postgres" {
		return "TIMESTAMPTZ"
	}
	return "DATETIME"
}

func (db *DB) now() string {
	if db.driver == "postgres" {
		return "NOW()"
	}
	return "datetime('now')"
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

func (db *DB) prepareQuery(query string) string {
	if db.driver == "postgres" {
		return replacePlaceholders(query)
	}
	return query
}

// --- Manufacturer Operations ---

func (db *DB) UpsertManufacturer(ctx context.Context, m *models.Manufacturer) (int, error) {
	query := fmt.Sprintf(`
		INSERT INTO manufacturers (uuid, name, slug, code, known_for, description, logo_url, raw_data, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, %s)
		%s`,
		db.now(),
		db.onConflictUpdate("uuid", `
			name=excluded.name, slug=excluded.slug, code=excluded.code,
			known_for=excluded.known_for, description=excluded.description,
			logo_url=excluded.logo_url, raw_data=excluded.raw_data,
			updated_at=excluded.updated_at`),
	)
	query = db.prepareQuery(query)

	if db.driver == "postgres" {
		query += " RETURNING id"
		var id int
		err := db.conn.QueryRowContext(ctx, query,
			m.UUID, m.Name, m.Slug, m.Code, m.KnownFor, m.Description, m.LogoURL, m.RawData,
		).Scan(&id)
		return id, err
	}

	res, err := db.conn.ExecContext(ctx, query,
		m.UUID, m.Name, m.Slug, m.Code, m.KnownFor, m.Description, m.LogoURL, m.RawData,
	)
	if err != nil {
		return 0, err
	}
	id, _ := res.LastInsertId()
	return int(id), nil
}

func (db *DB) GetManufacturerIDByUUID(ctx context.Context, uuid string) (int, error) {
	query := db.prepareQuery("SELECT id FROM manufacturers WHERE uuid = ?")
	var id int
	err := db.conn.QueryRowContext(ctx, query, uuid).Scan(&id)
	return id, err
}

func (db *DB) GetManufacturerIDByName(ctx context.Context, name string) (int, error) {
	query := db.prepareQuery("SELECT id FROM manufacturers WHERE name = ?")
	var id int
	err := db.conn.QueryRowContext(ctx, query, name).Scan(&id)
	return id, err
}

func (db *DB) GetManufacturerIDByCode(ctx context.Context, code string) (int, error) {
	query := db.prepareQuery("SELECT id FROM manufacturers WHERE code = ?")
	var id int
	err := db.conn.QueryRowContext(ctx, query, code).Scan(&id)
	return id, err
}

// ResolveManufacturerID tries multiple strategies to find a manufacturer:
// 1. Exact name match
// 2. Exact code match
// 3. Name prefix match (e.g. "Tumbril" → "Tumbril Land Systems")
// 4. Bidirectional code prefix match with uniqueness check
func (db *DB) ResolveManufacturerID(ctx context.Context, name, code string) (int, error) {
	// Try exact name
	if name != "" {
		if id, err := db.GetManufacturerIDByName(ctx, name); err == nil {
			return id, nil
		}
	}
	// Try exact code
	if code != "" {
		if id, err := db.GetManufacturerIDByCode(ctx, code); err == nil {
			return id, nil
		}
	}
	// Try name as prefix (FleetYards "Tumbril" → SC Wiki "Tumbril Land Systems")
	if name != "" {
		query := db.prepareQuery("SELECT id FROM manufacturers WHERE name LIKE ? ORDER BY name LIMIT 1")
		var id int
		if err := db.conn.QueryRowContext(ctx, query, name+"%").Scan(&id); err == nil {
			return id, nil
		}
	}
	// Bidirectional code prefix match — only if exactly one manufacturer matches
	if code != "" && len(code) >= 3 {
		query := db.prepareQuery(`
			SELECT id FROM manufacturers
			WHERE code IS NOT NULL AND code <> '' AND (code LIKE ? OR ? LIKE code || '%')
			LIMIT 2`)
		rows, err := db.conn.QueryContext(ctx, query, code+"%", code)
		if err == nil {
			defer rows.Close()
			var ids []int
			for rows.Next() {
				var id int
				if err := rows.Scan(&id); err != nil {
					log.Warn().Err(err).Msg("scan error in ResolveManufacturerID")
					continue
				}
				ids = append(ids, id)
			}
			if len(ids) == 1 {
				return ids[0], nil
			}
		}
	}
	// Final fallback: well-known SC abbreviations where API names don't match
	if name != "" {
		knownAbbrevs := map[string]string{
			"MISC": "Musashi Industrial & Starflight Concern",
		}
		if fullName, ok := knownAbbrevs[name]; ok {
			if id, err := db.GetManufacturerIDByName(ctx, fullName); err == nil {
				return id, nil
			}
		}
	}
	return 0, fmt.Errorf("manufacturer not found: name=%q code=%q", name, code)
}

// UpdateManufacturerCode sets the code field on a manufacturer (backfill from FleetYards)
func (db *DB) UpdateManufacturerCode(ctx context.Context, id int, code string) {
	query := db.prepareQuery("UPDATE manufacturers SET code = ? WHERE id = ? AND (code IS NULL OR code = '')")
	db.conn.ExecContext(ctx, query, code, id)
}

func (db *DB) GetProductionStatusIDByKey(ctx context.Context, key string) (int, error) {
	query := db.prepareQuery("SELECT id FROM production_statuses WHERE key = ?")
	var id int
	err := db.conn.QueryRowContext(ctx, query, key).Scan(&id)
	return id, err
}

// --- Game Version Operations ---

func (db *DB) UpsertGameVersion(ctx context.Context, gv *models.GameVersion) (int, error) {
	query := fmt.Sprintf(`
		INSERT INTO game_versions (uuid, code, channel, is_default, released_at, updated_at)
		VALUES (?, ?, ?, ?, ?, %s)
		%s`,
		db.now(),
		db.onConflictUpdate("uuid", `
			code=excluded.code, channel=excluded.channel,
			is_default=excluded.is_default, released_at=excluded.released_at,
			updated_at=excluded.updated_at`),
	)
	query = db.prepareQuery(query)

	if db.driver == "postgres" {
		query += " RETURNING id"
		var id int
		err := db.conn.QueryRowContext(ctx, query,
			gv.UUID, gv.Code, gv.Channel, gv.IsDefault, gv.ReleasedAt,
		).Scan(&id)
		return id, err
	}

	res, err := db.conn.ExecContext(ctx, query,
		gv.UUID, gv.Code, gv.Channel, gv.IsDefault, gv.ReleasedAt,
	)
	if err != nil {
		return 0, err
	}
	id, _ := res.LastInsertId()
	return int(id), nil
}

func (db *DB) GetGameVersionIDByUUID(ctx context.Context, uuid string) (int, error) {
	query := db.prepareQuery("SELECT id FROM game_versions WHERE uuid = ?")
	var id int
	err := db.conn.QueryRowContext(ctx, query, uuid).Scan(&id)
	return id, err
}

// --- Vehicle (Reference) Operations ---

func (db *DB) UpsertVehicle(ctx context.Context, v *models.Vehicle) (int, error) {
	query := fmt.Sprintf(`
		INSERT INTO vehicles (uuid, slug, name, class_name, manufacturer_id, vehicle_type_id,
			production_status_id, size, size_label, focus, classification, description,
			length, beam, height, mass, cargo, vehicle_inventory, crew_min, crew_max,
			speed_scm, speed_max, health, pledge_price, price_auec, on_sale,
			image_url, image_url_small, image_url_medium, image_url_large,
			pledge_url, game_version_id, raw_data, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, %s)
		%s`,
		db.now(),
		db.onConflictUpdate("slug", `
			uuid=COALESCE(excluded.uuid, vehicles.uuid),
			name=excluded.name, class_name=COALESCE(excluded.class_name, vehicles.class_name),
			manufacturer_id=COALESCE(excluded.manufacturer_id, vehicles.manufacturer_id),
			vehicle_type_id=COALESCE(excluded.vehicle_type_id, vehicles.vehicle_type_id),
			production_status_id=COALESCE(excluded.production_status_id, vehicles.production_status_id),
			size=COALESCE(excluded.size, vehicles.size),
			size_label=COALESCE(excluded.size_label, vehicles.size_label),
			focus=COALESCE(excluded.focus, vehicles.focus),
			classification=COALESCE(excluded.classification, vehicles.classification),
			description=COALESCE(excluded.description, vehicles.description),
			length=COALESCE(excluded.length, vehicles.length),
			beam=COALESCE(excluded.beam, vehicles.beam),
			height=COALESCE(excluded.height, vehicles.height),
			mass=COALESCE(excluded.mass, vehicles.mass),
			cargo=COALESCE(excluded.cargo, vehicles.cargo),
			vehicle_inventory=COALESCE(excluded.vehicle_inventory, vehicles.vehicle_inventory),
			crew_min=COALESCE(excluded.crew_min, vehicles.crew_min),
			crew_max=COALESCE(excluded.crew_max, vehicles.crew_max),
			speed_scm=COALESCE(excluded.speed_scm, vehicles.speed_scm),
			speed_max=COALESCE(excluded.speed_max, vehicles.speed_max),
			health=COALESCE(excluded.health, vehicles.health),
			pledge_price=COALESCE(excluded.pledge_price, vehicles.pledge_price),
			price_auec=COALESCE(excluded.price_auec, vehicles.price_auec),
			on_sale=excluded.on_sale,
			image_url=COALESCE(excluded.image_url, vehicles.image_url),
			image_url_small=COALESCE(excluded.image_url_small, vehicles.image_url_small),
			image_url_medium=COALESCE(excluded.image_url_medium, vehicles.image_url_medium),
			image_url_large=COALESCE(excluded.image_url_large, vehicles.image_url_large),
			pledge_url=COALESCE(excluded.pledge_url, vehicles.pledge_url),
			game_version_id=COALESCE(excluded.game_version_id, vehicles.game_version_id),
			raw_data=COALESCE(excluded.raw_data, vehicles.raw_data),
			updated_at=excluded.updated_at`),
	)
	query = db.prepareQuery(query)

	args := []interface{}{
		nullableStr(v.UUID), v.Slug, v.Name, nullableStr(v.ClassName),
		v.ManufacturerID, v.VehicleTypeID, v.ProductionStatusID,
		nullableInt(v.Size), nullableStr(v.SizeLabel), nullableStr(v.Focus),
		nullableStr(v.Classification), nullableStr(v.Description),
		nullableFloat(v.Length), nullableFloat(v.Beam), nullableFloat(v.Height),
		nullableFloat(v.Mass), nullableFloat(v.Cargo), nullableFloat(v.VehicleInventory),
		nullableInt(v.CrewMin), nullableInt(v.CrewMax),
		nullableFloat(v.SpeedSCM), nullableFloat(v.SpeedMax), nullableFloat(v.Health),
		nullableFloat(v.PledgePrice), nullableFloat(v.PriceAUEC), v.OnSale,
		nullableStr(v.ImageURL), nullableStr(v.ImageURLSmall),
		nullableStr(v.ImageURLMedium), nullableStr(v.ImageURLLarge),
		nullableStr(v.PledgeURL), v.GameVersionID, nullableStr(v.RawData),
	}

	if db.driver == "postgres" {
		query += " RETURNING id"
		var id int
		err := db.conn.QueryRowContext(ctx, query, args...).Scan(&id)
		return id, err
	}

	res, err := db.conn.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	id, _ := res.LastInsertId()
	return int(id), nil
}

func (db *DB) GetAllVehicles(ctx context.Context) ([]models.Vehicle, error) {
	rows, err := db.conn.QueryContext(ctx, `
		SELECT v.id, v.uuid, v.slug, v.name, v.class_name,
			v.size, v.size_label, v.focus, v.classification, v.description,
			v.length, v.beam, v.height, v.mass, v.cargo,
			v.crew_min, v.crew_max, v.speed_scm, v.pledge_price, v.on_sale,
			v.image_url, v.image_url_small, v.image_url_medium, v.image_url_large,
			v.pledge_url,
			m.name, m.code,
			ps.key
		FROM vehicles v
		LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
		LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
		ORDER BY v.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vehicles []models.Vehicle
	for rows.Next() {
		var v models.Vehicle
		var uuid, className, sizeLabel, focus, classification, description sql.NullString
		var imageURL, imageURLSmall, imageURLMedium, imageURLLarge, fyURL sql.NullString
		var mfName, mfCode, psKey sql.NullString
		var size sql.NullInt64
		var length, beam, height, mass, cargo, speedSCM, pledgePrice sql.NullFloat64
		var crewMin, crewMax sql.NullInt64

		err := rows.Scan(&v.ID, &uuid, &v.Slug, &v.Name, &className,
			&size, &sizeLabel, &focus, &classification, &description,
			&length, &beam, &height, &mass, &cargo,
			&crewMin, &crewMax, &speedSCM, &pledgePrice, &v.OnSale,
			&imageURL, &imageURLSmall, &imageURLMedium, &imageURLLarge,
			&fyURL,
			&mfName, &mfCode,
			&psKey)
		if err != nil {
			return nil, err
		}

		v.UUID = uuid.String
		v.ClassName = className.String
		v.Size = int(size.Int64)
		v.SizeLabel = sizeLabel.String
		v.Focus = focus.String
		v.Classification = classification.String
		v.Description = description.String
		v.Length = length.Float64
		v.Beam = beam.Float64
		v.Height = height.Float64
		v.Mass = mass.Float64
		v.Cargo = cargo.Float64
		v.CrewMin = int(crewMin.Int64)
		v.CrewMax = int(crewMax.Int64)
		v.SpeedSCM = speedSCM.Float64
		v.PledgePrice = pledgePrice.Float64
		v.ImageURL = imageURL.String
		v.ImageURLSmall = imageURLSmall.String
		v.ImageURLMedium = imageURLMedium.String
		v.ImageURLLarge = imageURLLarge.String
		v.PledgeURL = fyURL.String
		v.ManufacturerName = mfName.String
		v.ManufacturerCode = mfCode.String
		v.ProductionStatus = psKey.String

		vehicles = append(vehicles, v)
	}
	return vehicles, rows.Err()
}

func (db *DB) GetVehicleBySlug(ctx context.Context, slug string) (*models.Vehicle, error) {
	query := db.prepareQuery(`
		SELECT v.id, v.uuid, v.slug, v.name, v.class_name,
			v.size, v.size_label, v.focus, v.classification, v.description,
			v.length, v.beam, v.height, v.mass, v.cargo,
			v.crew_min, v.crew_max, v.speed_scm, v.pledge_price, v.on_sale,
			v.image_url, v.image_url_small, v.image_url_medium, v.image_url_large,
			v.pledge_url,
			m.name, m.code,
			ps.key
		FROM vehicles v
		LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
		LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
		WHERE v.slug = ?`)

	var v models.Vehicle
	var uuid, className, sizeLabel, focus, classification, description sql.NullString
	var imageURL, imageURLSmall, imageURLMedium, imageURLLarge, fyURL sql.NullString
	var mfName, mfCode, psKey sql.NullString
	var size sql.NullInt64
	var length, beam, height, mass, cargo, speedSCM, pledgePrice sql.NullFloat64
	var crewMin, crewMax sql.NullInt64

	err := db.conn.QueryRowContext(ctx, query, slug).Scan(
		&v.ID, &uuid, &v.Slug, &v.Name, &className,
		&size, &sizeLabel, &focus, &classification, &description,
		&length, &beam, &height, &mass, &cargo,
		&crewMin, &crewMax, &speedSCM, &pledgePrice, &v.OnSale,
		&imageURL, &imageURLSmall, &imageURLMedium, &imageURLLarge,
		&fyURL,
		&mfName, &mfCode,
		&psKey)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	v.UUID = uuid.String
	v.ClassName = className.String
	v.Size = int(size.Int64)
	v.SizeLabel = sizeLabel.String
	v.Focus = focus.String
	v.Classification = classification.String
	v.Description = description.String
	v.Length = length.Float64
	v.Beam = beam.Float64
	v.Height = height.Float64
	v.Mass = mass.Float64
	v.Cargo = cargo.Float64
	v.CrewMin = int(crewMin.Int64)
	v.CrewMax = int(crewMax.Int64)
	v.SpeedSCM = speedSCM.Float64
	v.PledgePrice = pledgePrice.Float64
	v.ImageURL = imageURL.String
	v.ImageURLSmall = imageURLSmall.String
	v.ImageURLMedium = imageURLMedium.String
	v.ImageURLLarge = imageURLLarge.String
	v.PledgeURL = fyURL.String
	v.ManufacturerName = mfName.String
	v.ManufacturerCode = mfCode.String
	v.ProductionStatus = psKey.String

	return &v, nil
}

func (db *DB) GetVehicleCount(ctx context.Context) (int, error) {
	var count int
	err := db.conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM vehicles").Scan(&count)
	return count, err
}

func (db *DB) GetManufacturerCount(ctx context.Context) (int, error) {
	var count int
	err := db.conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM manufacturers").Scan(&count)
	return count, err
}

func (db *DB) GetVehicleIDBySlug(ctx context.Context, slug string) (int, error) {
	query := db.prepareQuery("SELECT id FROM vehicles WHERE slug = ? LIMIT 1")
	var id int
	err := db.conn.QueryRowContext(ctx, query, slug).Scan(&id)
	return id, err
}

// FindVehicleSlug tries to find a matching vehicle in the reference DB.
// Tries: exact slug match, then name LIKE match, then partial slug match.
func (db *DB) FindVehicleSlug(ctx context.Context, candidateSlugs []string, displayName string) string {
	for _, slug := range candidateSlugs {
		if slug == "" {
			continue
		}
		query := db.prepareQuery("SELECT slug FROM vehicles WHERE slug = ? LIMIT 1")
		var found string
		if err := db.conn.QueryRowContext(ctx, query, slug).Scan(&found); err == nil {
			return found
		}
	}

	if displayName != "" {
		query := db.prepareQuery("SELECT slug FROM vehicles WHERE LOWER(name) = LOWER(?) LIMIT 1")
		var found string
		if err := db.conn.QueryRowContext(ctx, query, displayName).Scan(&found); err == nil {
			return found
		}
	}

	for _, slug := range candidateSlugs {
		if slug == "" || len(slug) < 3 {
			continue
		}
		query := db.prepareQuery("SELECT slug FROM vehicles WHERE slug LIKE ? LIMIT 1")
		var found string
		pattern := slug + "%"
		if err := db.conn.QueryRowContext(ctx, query, pattern).Scan(&found); err == nil {
			return found
		}
	}

	return ""
}

// UpdateVehicleImages updates only image columns for a vehicle by slug.
// Used by the FleetYards image-only sync.
func (db *DB) UpdateVehicleImages(ctx context.Context, slug, imageURL, small, medium, large string) error {
	query := db.prepareQuery(`UPDATE vehicles SET
		image_url = ?, image_url_small = ?, image_url_medium = ?, image_url_large = ?,
		updated_at = ` + db.now() + `
		WHERE slug = ?`)
	_, err := db.conn.ExecContext(ctx, query, imageURL, small, medium, large, slug)
	return err
}

// SyncVehicleLoaners replaces the loaners for a vehicle with the given loaner slugs.
func (db *DB) SyncVehicleLoaners(ctx context.Context, vehicleID int, loanerSlugs []string) error {
	// Delete existing loaners for this vehicle
	delQuery := db.prepareQuery("DELETE FROM vehicle_loaners WHERE vehicle_id = ?")
	if _, err := db.conn.ExecContext(ctx, delQuery, vehicleID); err != nil {
		return fmt.Errorf("deleting old loaners: %w", err)
	}

	// Insert new loaners (resolve slug → id)
	insQuery := db.prepareQuery("INSERT OR IGNORE INTO vehicle_loaners (vehicle_id, loaner_id) SELECT ?, id FROM vehicles WHERE slug = ?")
	if db.driver == "postgres" {
		insQuery = db.prepareQuery("INSERT INTO vehicle_loaners (vehicle_id, loaner_id) SELECT ?, id FROM vehicles WHERE slug = ? ON CONFLICT DO NOTHING")
	}

	for _, slug := range loanerSlugs {
		if _, err := db.conn.ExecContext(ctx, insQuery, vehicleID, slug); err != nil {
			return fmt.Errorf("inserting loaner %s: %w", slug, err)
		}
	}
	return nil
}

// --- Component Operations ---

func (db *DB) UpsertComponent(ctx context.Context, c *models.Component) error {
	query := fmt.Sprintf(`
		INSERT INTO components (uuid, name, slug, class_name, manufacturer_id, type, sub_type,
			size, grade, description, game_version_id, raw_data, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, %s)
		%s`,
		db.now(),
		db.onConflictUpdate("uuid", `
			name=excluded.name, slug=excluded.slug, class_name=excluded.class_name,
			manufacturer_id=excluded.manufacturer_id, type=excluded.type, sub_type=excluded.sub_type,
			size=excluded.size, grade=excluded.grade, description=excluded.description,
			game_version_id=excluded.game_version_id, raw_data=excluded.raw_data,
			updated_at=excluded.updated_at`),
	)
	query = db.prepareQuery(query)

	_, err := db.conn.ExecContext(ctx, query,
		c.UUID, c.Name, c.Slug, c.ClassName, c.ManufacturerID,
		c.Type, c.SubType, c.Size, c.Grade, c.Description,
		c.GameVersionID, c.RawData,
	)
	return err
}

// --- FPS Item Operations (all follow same pattern) ---

func (db *DB) UpsertFPSWeapon(ctx context.Context, item *models.FPSWeapon) error {
	query := fmt.Sprintf(`
		INSERT INTO fps_weapons (uuid, name, slug, class_name, manufacturer_id, sub_type, size, description, game_version_id, raw_data, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, %s)
		%s`, db.now(), db.onConflictUpdate("uuid", `name=excluded.name, slug=excluded.slug, class_name=excluded.class_name, manufacturer_id=excluded.manufacturer_id, sub_type=excluded.sub_type, size=excluded.size, description=excluded.description, game_version_id=excluded.game_version_id, raw_data=excluded.raw_data, updated_at=excluded.updated_at`))
	query = db.prepareQuery(query)
	_, err := db.conn.ExecContext(ctx, query, item.UUID, item.Name, item.Slug, item.ClassName, item.ManufacturerID, item.SubType, item.Size, item.Description, item.GameVersionID, item.RawData)
	return err
}

func (db *DB) UpsertFPSArmour(ctx context.Context, item *models.FPSArmour) error {
	query := fmt.Sprintf(`
		INSERT INTO fps_armour (uuid, name, slug, class_name, manufacturer_id, sub_type, size, grade, description, game_version_id, raw_data, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, %s)
		%s`, db.now(), db.onConflictUpdate("uuid", `name=excluded.name, slug=excluded.slug, class_name=excluded.class_name, manufacturer_id=excluded.manufacturer_id, sub_type=excluded.sub_type, size=excluded.size, grade=excluded.grade, description=excluded.description, game_version_id=excluded.game_version_id, raw_data=excluded.raw_data, updated_at=excluded.updated_at`))
	query = db.prepareQuery(query)
	_, err := db.conn.ExecContext(ctx, query, item.UUID, item.Name, item.Slug, item.ClassName, item.ManufacturerID, item.SubType, item.Size, item.Grade, item.Description, item.GameVersionID, item.RawData)
	return err
}

func (db *DB) UpsertFPSAttachment(ctx context.Context, item *models.FPSAttachment) error {
	query := fmt.Sprintf(`
		INSERT INTO fps_attachments (uuid, name, slug, class_name, manufacturer_id, sub_type, size, description, game_version_id, raw_data, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, %s)
		%s`, db.now(), db.onConflictUpdate("uuid", `name=excluded.name, slug=excluded.slug, class_name=excluded.class_name, manufacturer_id=excluded.manufacturer_id, sub_type=excluded.sub_type, size=excluded.size, description=excluded.description, game_version_id=excluded.game_version_id, raw_data=excluded.raw_data, updated_at=excluded.updated_at`))
	query = db.prepareQuery(query)
	_, err := db.conn.ExecContext(ctx, query, item.UUID, item.Name, item.Slug, item.ClassName, item.ManufacturerID, item.SubType, item.Size, item.Description, item.GameVersionID, item.RawData)
	return err
}

func (db *DB) UpsertFPSAmmo(ctx context.Context, item *models.FPSAmmo) error {
	query := fmt.Sprintf(`
		INSERT INTO fps_ammo (uuid, name, slug, class_name, manufacturer_id, sub_type, description, game_version_id, raw_data, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, %s)
		%s`, db.now(), db.onConflictUpdate("uuid", `name=excluded.name, slug=excluded.slug, class_name=excluded.class_name, manufacturer_id=excluded.manufacturer_id, sub_type=excluded.sub_type, description=excluded.description, game_version_id=excluded.game_version_id, raw_data=excluded.raw_data, updated_at=excluded.updated_at`))
	query = db.prepareQuery(query)
	_, err := db.conn.ExecContext(ctx, query, item.UUID, item.Name, item.Slug, item.ClassName, item.ManufacturerID, item.SubType, item.Description, item.GameVersionID, item.RawData)
	return err
}

func (db *DB) UpsertFPSUtility(ctx context.Context, item *models.FPSUtility) error {
	query := fmt.Sprintf(`
		INSERT INTO fps_utilities (uuid, name, slug, class_name, manufacturer_id, sub_type, description, game_version_id, raw_data, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, %s)
		%s`, db.now(), db.onConflictUpdate("uuid", `name=excluded.name, slug=excluded.slug, class_name=excluded.class_name, manufacturer_id=excluded.manufacturer_id, sub_type=excluded.sub_type, description=excluded.description, game_version_id=excluded.game_version_id, raw_data=excluded.raw_data, updated_at=excluded.updated_at`))
	query = db.prepareQuery(query)
	_, err := db.conn.ExecContext(ctx, query, item.UUID, item.Name, item.Slug, item.ClassName, item.ManufacturerID, item.SubType, item.Description, item.GameVersionID, item.RawData)
	return err
}

// --- Port Operations ---

func (db *DB) UpsertPort(ctx context.Context, p *models.Port) error {
	query := fmt.Sprintf(`
		INSERT INTO ports (uuid, vehicle_id, parent_port_id, name, position, category_label,
			size_min, size_max, port_type, port_subtype, equipped_item_uuid, editable, health)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		%s`,
		db.onConflictUpdate("uuid", `
			vehicle_id=excluded.vehicle_id, name=excluded.name, category_label=excluded.category_label,
			size_min=excluded.size_min, size_max=excluded.size_max, port_type=excluded.port_type,
			equipped_item_uuid=excluded.equipped_item_uuid`),
	)
	query = db.prepareQuery(query)

	_, err := db.conn.ExecContext(ctx, query,
		p.UUID, p.VehicleID, p.ParentPortID, p.Name, p.Position, p.CategoryLabel,
		p.SizeMin, p.SizeMax, p.PortType, p.PortSubtype, p.EquippedItemUUID, p.Editable, p.Health,
	)
	return err
}

// --- Paint Operations ---

// UpsertPaint inserts or updates a paint by class_name.
// Uses COALESCE so scunpacked metadata and FleetYards images don't overwrite each other.
func (db *DB) UpsertPaint(ctx context.Context, p *models.Paint) (int, error) {
	query := fmt.Sprintf(`
		INSERT INTO paints (uuid, name, slug, class_name, vehicle_id, description,
			image_url, image_url_small, image_url_medium, image_url_large, raw_data, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, %s)
		%s`,
		db.now(),
		db.onConflictUpdate("class_name", `
			name=excluded.name,
			slug=COALESCE(excluded.slug, paints.slug),
			vehicle_id=COALESCE(excluded.vehicle_id, paints.vehicle_id),
			description=COALESCE(excluded.description, paints.description),
			image_url=COALESCE(excluded.image_url, paints.image_url),
			image_url_small=COALESCE(excluded.image_url_small, paints.image_url_small),
			image_url_medium=COALESCE(excluded.image_url_medium, paints.image_url_medium),
			image_url_large=COALESCE(excluded.image_url_large, paints.image_url_large),
			raw_data=COALESCE(excluded.raw_data, paints.raw_data),
			updated_at=excluded.updated_at`),
	)
	query = db.prepareQuery(query)

	args := []interface{}{
		nullableStr(p.UUID), p.Name, nullableStr(p.Slug), nullableStr(p.ClassName),
		p.VehicleID, nullableStr(p.Description),
		nullableStr(p.ImageURL), nullableStr(p.ImageURLSmall),
		nullableStr(p.ImageURLMedium), nullableStr(p.ImageURLLarge),
		nullableStr(p.RawData),
	}

	if db.driver == "postgres" {
		query += " RETURNING id"
		var id int
		err := db.conn.QueryRowContext(ctx, query, args...).Scan(&id)
		return id, err
	}

	res, err := db.conn.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	id, _ := res.LastInsertId()
	return int(id), nil
}

// UpdatePaintImages updates only image columns for a paint by class_name.
func (db *DB) UpdatePaintImages(ctx context.Context, className, imageURL, small, medium, large string) error {
	query := db.prepareQuery(`UPDATE paints SET
		image_url = ?, image_url_small = ?, image_url_medium = ?, image_url_large = ?,
		updated_at = ` + db.now() + `
		WHERE class_name = ?`)
	_, err := db.conn.ExecContext(ctx, query, imageURL, small, medium, large, className)
	return err
}

// GetAllPaints returns all paints with joined vehicle info.
func (db *DB) GetAllPaints(ctx context.Context) ([]models.Paint, error) {
	rows, err := db.conn.QueryContext(ctx, `
		SELECT p.id, p.uuid, p.name, p.slug, p.class_name, p.vehicle_id,
			p.description, p.image_url, p.image_url_small, p.image_url_medium, p.image_url_large,
			p.created_at, p.updated_at,
			v.name, v.slug
		FROM paints p
		LEFT JOIN vehicles v ON v.id = p.vehicle_id
		ORDER BY p.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paints []models.Paint
	for rows.Next() {
		var p models.Paint
		var uuid, slug, className, description sql.NullString
		var imageURL, imageURLSmall, imageURLMedium, imageURLLarge sql.NullString
		var vehicleID sql.NullInt64
		var vName, vSlug sql.NullString

		err := rows.Scan(&p.ID, &uuid, &p.Name, &slug, &className, &vehicleID,
			&description, &imageURL, &imageURLSmall, &imageURLMedium, &imageURLLarge,
			&p.CreatedAt, &p.UpdatedAt,
			&vName, &vSlug)
		if err != nil {
			return nil, err
		}

		p.UUID = uuid.String
		p.Slug = slug.String
		p.ClassName = className.String
		p.Description = description.String
		p.ImageURL = imageURL.String
		p.ImageURLSmall = imageURLSmall.String
		p.ImageURLMedium = imageURLMedium.String
		p.ImageURLLarge = imageURLLarge.String
		if vehicleID.Valid {
			id := int(vehicleID.Int64)
			p.VehicleID = &id
		}
		p.VehicleName = vName.String
		p.VehicleSlug = vSlug.String

		paints = append(paints, p)
	}
	return paints, rows.Err()
}

// GetPaintsForVehicle returns paints for a specific vehicle by slug.
func (db *DB) GetPaintsForVehicle(ctx context.Context, vehicleSlug string) ([]models.Paint, error) {
	query := db.prepareQuery(`
		SELECT p.id, p.uuid, p.name, p.slug, p.class_name, p.vehicle_id,
			p.description, p.image_url, p.image_url_small, p.image_url_medium, p.image_url_large,
			p.created_at, p.updated_at,
			v.name, v.slug
		FROM paints p
		JOIN vehicles v ON v.id = p.vehicle_id
		WHERE v.slug = ?
		ORDER BY p.name`)

	rows, err := db.conn.QueryContext(ctx, query, vehicleSlug)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paints []models.Paint
	for rows.Next() {
		var p models.Paint
		var uuid, slug, className, description sql.NullString
		var imageURL, imageURLSmall, imageURLMedium, imageURLLarge sql.NullString
		var vehicleID sql.NullInt64
		var vName, vSlug sql.NullString

		err := rows.Scan(&p.ID, &uuid, &p.Name, &slug, &className, &vehicleID,
			&description, &imageURL, &imageURLSmall, &imageURLMedium, &imageURLLarge,
			&p.CreatedAt, &p.UpdatedAt,
			&vName, &vSlug)
		if err != nil {
			return nil, err
		}

		p.UUID = uuid.String
		p.Slug = slug.String
		p.ClassName = className.String
		p.Description = description.String
		p.ImageURL = imageURL.String
		p.ImageURLSmall = imageURLSmall.String
		p.ImageURLMedium = imageURLMedium.String
		p.ImageURLLarge = imageURLLarge.String
		if vehicleID.Valid {
			id := int(vehicleID.Int64)
			p.VehicleID = &id
		}
		p.VehicleName = vName.String
		p.VehicleSlug = vSlug.String

		paints = append(paints, p)
	}
	return paints, rows.Err()
}

// GetPaintCount returns the total number of paints.
func (db *DB) GetPaintCount(ctx context.Context) (int, error) {
	var count int
	err := db.conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM paints").Scan(&count)
	return count, err
}

// GetVehicleSlugsWithPaints returns vehicle slugs that have associated paints.
func (db *DB) GetVehicleSlugsWithPaints(ctx context.Context) ([]string, error) {
	rows, err := db.conn.QueryContext(ctx, `
		SELECT DISTINCT v.slug
		FROM paints p
		JOIN vehicles v ON v.id = p.vehicle_id
		WHERE p.vehicle_id IS NOT NULL
		ORDER BY v.slug`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var slugs []string
	for rows.Next() {
		var slug string
		if err := rows.Scan(&slug); err != nil {
			return nil, err
		}
		slugs = append(slugs, slug)
	}
	return slugs, rows.Err()
}

// GetPaintsByVehicleSlug returns paints for a vehicle, used for FY image name matching.
func (db *DB) GetPaintsByVehicleSlug(ctx context.Context, vehicleSlug string) ([]models.Paint, error) {
	return db.GetPaintsForVehicle(ctx, vehicleSlug)
}

// --- User Operations ---

func (db *DB) GetDefaultUser(ctx context.Context) (*models.User, error) {
	var u models.User
	err := db.conn.QueryRowContext(ctx, "SELECT id, username, handle, email FROM users WHERE username = 'default'").Scan(
		&u.ID, &u.Username, &u.Handle, &u.Email)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &u, err
}

func (db *DB) GetDefaultUserID(ctx context.Context) int {
	var id int
	db.conn.QueryRowContext(ctx, "SELECT id FROM users WHERE username = 'default'").Scan(&id)
	return id
}

// --- User Fleet Operations ---

func (db *DB) InsertUserFleetEntry(ctx context.Context, entry *models.UserFleetEntry) (int, error) {
	query := fmt.Sprintf(`
		INSERT INTO user_fleet (user_id, vehicle_id, insurance_type_id, warbond, is_loaner,
			pledge_id, pledge_name, pledge_cost, pledge_date, custom_name, equipped_paint_id, imported_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, %s)`, db.now())
	query = db.prepareQuery(query)

	if db.driver == "postgres" {
		query += " RETURNING id"
		var id int
		err := db.conn.QueryRowContext(ctx, query,
			entry.UserID, entry.VehicleID, entry.InsuranceTypeID, entry.Warbond, entry.IsLoaner,
			entry.PledgeID, entry.PledgeName, entry.PledgeCost, entry.PledgeDate, entry.CustomName, entry.EquippedPaintID,
		).Scan(&id)
		return id, err
	}

	res, err := db.conn.ExecContext(ctx, query,
		entry.UserID, entry.VehicleID, entry.InsuranceTypeID, entry.Warbond, entry.IsLoaner,
		entry.PledgeID, entry.PledgeName, entry.PledgeCost, entry.PledgeDate, entry.CustomName, entry.EquippedPaintID,
	)
	if err != nil {
		return 0, err
	}
	id, _ := res.LastInsertId()
	return int(id), nil
}

func (db *DB) ClearUserFleet(ctx context.Context, userID int) error {
	query := db.prepareQuery("DELETE FROM user_fleet WHERE user_id = ?")
	_, err := db.conn.ExecContext(ctx, query, userID)
	return err
}

func (db *DB) GetUserFleetCount(ctx context.Context, userID int) (int, error) {
	query := db.prepareQuery("SELECT COUNT(*) FROM user_fleet WHERE user_id = ?")
	var count int
	err := db.conn.QueryRowContext(ctx, query, userID).Scan(&count)
	return count, err
}

// GetUserFleet returns the user's fleet with full reference data JOINed in.
func (db *DB) GetUserFleet(ctx context.Context, userID int) ([]models.UserFleetEntry, error) {
	query := db.prepareQuery(`
		SELECT uf.id, uf.user_id, uf.vehicle_id, uf.insurance_type_id, uf.warbond, uf.is_loaner,
			uf.pledge_id, uf.pledge_name, uf.pledge_cost, uf.pledge_date, uf.custom_name,
			uf.equipped_paint_id, uf.imported_at,
			v.name, v.slug, v.image_url, v.focus, v.size_label, v.cargo,
			v.crew_min, v.crew_max, v.pledge_price, v.speed_scm, v.classification,
			m.name, m.code,
			it.label, it.duration_months, it.is_lifetime,
			p.name,
			ps.key
		FROM user_fleet uf
		JOIN vehicles v ON v.id = uf.vehicle_id
		LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
		LEFT JOIN insurance_types it ON it.id = uf.insurance_type_id
		LEFT JOIN paints p ON p.id = uf.equipped_paint_id
		LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
		WHERE uf.user_id = ?
		ORDER BY v.name`)

	rows, err := db.conn.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []models.UserFleetEntry
	for rows.Next() {
		var e models.UserFleetEntry
		var insuranceTypeID, equippedPaintID sql.NullInt64
		var pledgeID, pledgeName, pledgeCost, pledgeDate, customName sql.NullString
		var vName, vSlug, vImageURL, vFocus, vSizeLabel, vClassification sql.NullString
		var mfName, mfCode sql.NullString
		var itLabel, paintName, psKey sql.NullString
		var itDuration sql.NullInt64
		var itLifetime sql.NullBool
		var vCargo, vPledgePrice, vSpeedSCM sql.NullFloat64
		var vCrewMin, vCrewMax sql.NullInt64

		err := rows.Scan(
			&e.ID, &e.UserID, &e.VehicleID, &insuranceTypeID, &e.Warbond, &e.IsLoaner,
			&pledgeID, &pledgeName, &pledgeCost, &pledgeDate, &customName,
			&equippedPaintID, &e.ImportedAt,
			&vName, &vSlug, &vImageURL, &vFocus, &vSizeLabel, &vCargo,
			&vCrewMin, &vCrewMax, &vPledgePrice, &vSpeedSCM, &vClassification,
			&mfName, &mfCode,
			&itLabel, &itDuration, &itLifetime,
			&paintName,
			&psKey,
		)
		if err != nil {
			return nil, err
		}

		if insuranceTypeID.Valid {
			id := int(insuranceTypeID.Int64)
			e.InsuranceTypeID = &id
		}
		if equippedPaintID.Valid {
			id := int(equippedPaintID.Int64)
			e.EquippedPaintID = &id
		}
		e.PledgeID = pledgeID.String
		e.PledgeName = pledgeName.String
		e.PledgeCost = pledgeCost.String
		e.PledgeDate = pledgeDate.String
		e.CustomName = customName.String
		e.VehicleName = vName.String
		e.VehicleSlug = vSlug.String
		e.ImageURL = vImageURL.String
		e.Focus = vFocus.String
		e.SizeLabel = vSizeLabel.String
		e.Cargo = vCargo.Float64
		e.CrewMin = int(vCrewMin.Int64)
		e.CrewMax = int(vCrewMax.Int64)
		e.PledgePrice = vPledgePrice.Float64
		e.SpeedSCM = vSpeedSCM.Float64
		e.Classification = vClassification.String
		e.ManufacturerName = mfName.String
		e.ManufacturerCode = mfCode.String
		e.InsuranceLabel = itLabel.String
		if itDuration.Valid {
			d := int(itDuration.Int64)
			e.DurationMonths = &d
		}
		e.IsLifetime = itLifetime.Bool
		e.PaintName = paintName.String
		e.ProductionStatus = psKey.String

		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// --- Insurance Type Operations ---

func (db *DB) GetInsuranceTypeIDByKey(ctx context.Context, key string) (int, error) {
	query := db.prepareQuery("SELECT id FROM insurance_types WHERE key = ?")
	var id int
	err := db.conn.QueryRowContext(ctx, query, key).Scan(&id)
	return id, err
}

// --- Sync History Operations ---

func (db *DB) InsertSyncHistory(ctx context.Context, sourceID int, endpoint, status string) (int, error) {
	query := fmt.Sprintf(`INSERT INTO sync_history (source_id, endpoint, status, started_at) VALUES (?, ?, ?, %s)`, db.now())
	query = db.prepareQuery(query)

	if db.driver == "postgres" {
		query += " RETURNING id"
		var id int
		err := db.conn.QueryRowContext(ctx, query, sourceID, endpoint, status).Scan(&id)
		return id, err
	}

	result, err := db.conn.ExecContext(ctx, query, sourceID, endpoint, status)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	return int(id), err
}

func (db *DB) UpdateSyncHistory(ctx context.Context, id int, status string, count int, errMsg string) error {
	query := fmt.Sprintf("UPDATE sync_history SET status = ?, record_count = ?, error_message = ?, completed_at = %s WHERE id = ?", db.now())
	query = db.prepareQuery(query)
	_, err := db.conn.ExecContext(ctx, query, status, count, errMsg, id)
	return err
}

func (db *DB) GetLatestSyncHistory(ctx context.Context) ([]models.SyncHistory, error) {
	rows, err := db.conn.QueryContext(ctx, `
		SELECT sh.id, sh.source_id, sh.endpoint, sh.status, sh.record_count,
			sh.error_message, sh.started_at, sh.completed_at,
			ss.label
		FROM sync_history sh
		LEFT JOIN sync_sources ss ON ss.id = sh.source_id
		ORDER BY sh.started_at DESC LIMIT 10`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var statuses []models.SyncHistory
	for rows.Next() {
		var s models.SyncHistory
		var completedAt sql.NullTime
		var endpoint, errorMsg, sourceLabel sql.NullString

		err := rows.Scan(&s.ID, &s.SourceID, &endpoint, &s.Status, &s.RecordCount,
			&errorMsg, &s.StartedAt, &completedAt, &sourceLabel)
		if err != nil {
			return nil, err
		}
		s.Endpoint = endpoint.String
		s.ErrorMessage = errorMsg.String
		if completedAt.Valid {
			s.CompletedAt = &completedAt.Time
		}
		s.SourceLabel = sourceLabel.String
		statuses = append(statuses, s)
	}
	return statuses, rows.Err()
}

// --- User LLM Config Operations ---

func (db *DB) GetUserLLMConfig(ctx context.Context, userID int) (*models.UserLLMConfig, error) {
	query := db.prepareQuery(`
		SELECT id, user_id, provider, encrypted_api_key, model
		FROM user_llm_configs WHERE user_id = ? LIMIT 1`)
	var c models.UserLLMConfig
	err := db.conn.QueryRowContext(ctx, query, userID).Scan(
		&c.ID, &c.UserID, &c.Provider, &c.EncryptedAPIKey, &c.Model)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &c, err
}

func (db *DB) UpsertUserLLMConfig(ctx context.Context, userID int, provider, encryptedKey, model string) error {
	query := fmt.Sprintf(`
		INSERT INTO user_llm_configs (user_id, provider, encrypted_api_key, model, updated_at)
		VALUES (?, ?, ?, ?, %s)
		%s`,
		db.now(),
		db.onConflictUpdate("user_id, provider", `
			encrypted_api_key=excluded.encrypted_api_key,
			model=excluded.model,
			updated_at=excluded.updated_at`),
	)
	query = db.prepareQuery(query)
	_, err := db.conn.ExecContext(ctx, query, userID, provider, encryptedKey, model)
	return err
}

func (db *DB) ClearUserLLMConfigs(ctx context.Context, userID int) error {
	query := db.prepareQuery("DELETE FROM user_llm_configs WHERE user_id = ?")
	_, err := db.conn.ExecContext(ctx, query, userID)
	return err
}

// --- AI Analysis Operations ---

func (db *DB) SaveAIAnalysis(ctx context.Context, userID int, provider, model string, vehicleCount int, analysis string) (int64, error) {
	query := db.prepareQuery(`INSERT INTO ai_analyses (user_id, provider, model, vehicle_count, analysis) VALUES (?, ?, ?, ?, ?)`)

	if db.driver == "postgres" {
		query += " RETURNING id"
		var id int64
		err := db.conn.QueryRowContext(ctx, query, userID, provider, model, vehicleCount, analysis).Scan(&id)
		return id, err
	}

	result, err := db.conn.ExecContext(ctx, query, userID, provider, model, vehicleCount, analysis)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (db *DB) GetLatestAIAnalysis(ctx context.Context, userID int) (*models.AIAnalysis, error) {
	query := db.prepareQuery(`SELECT id, user_id, created_at, provider, model, vehicle_count, analysis FROM ai_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`)
	var a models.AIAnalysis
	err := db.conn.QueryRowContext(ctx, query, userID).Scan(&a.ID, &a.UserID, &a.CreatedAt, &a.Provider, &a.Model, &a.VehicleCount, &a.Analysis)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &a, err
}

func (db *DB) GetAIAnalysisHistory(ctx context.Context, userID int, limit int) ([]models.AIAnalysis, error) {
	if limit == 0 {
		limit = 50
	}
	query := db.prepareQuery(fmt.Sprintf(`SELECT id, user_id, created_at, provider, model, vehicle_count, analysis FROM ai_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT %d`, limit))

	rows, err := db.conn.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var analyses []models.AIAnalysis
	for rows.Next() {
		var a models.AIAnalysis
		if err := rows.Scan(&a.ID, &a.UserID, &a.CreatedAt, &a.Provider, &a.Model, &a.VehicleCount, &a.Analysis); err != nil {
			return nil, err
		}
		analyses = append(analyses, a)
	}
	return analyses, rows.Err()
}

func (db *DB) DeleteAIAnalysis(ctx context.Context, id int64) error {
	query := db.prepareQuery(`DELETE FROM ai_analyses WHERE id = ?`)
	_, err := db.conn.ExecContext(ctx, query, id)
	return err
}

// --- App Settings Operations ---

func (db *DB) GetAppSetting(ctx context.Context, key string) (string, error) {
	query := db.prepareQuery("SELECT value FROM app_settings WHERE key = ?")
	var value string
	err := db.conn.QueryRowContext(ctx, query, key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return value, err
}

func (db *DB) SetAppSetting(ctx context.Context, key, value string) error {
	query := db.prepareQuery("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
	_, err := db.conn.ExecContext(ctx, query, key, value)
	return err
}

// --- Raw Query (diagnostics) ---

func (db *DB) RawQuery(ctx context.Context, query string) (*sql.Rows, error) {
	return db.conn.QueryContext(ctx, query)
}

func (db *DB) RawQueryRow(ctx context.Context, query string) *sql.Row {
	return db.conn.QueryRowContext(ctx, query)
}

// --- Nullable helpers ---

func nullableStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func nullableInt(n int) interface{} {
	if n == 0 {
		return nil
	}
	return n
}

func nullableFloat(f float64) interface{} {
	if f == 0 {
		return nil
	}
	return f
}
