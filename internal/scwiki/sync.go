package scwiki

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// Syncer handles synchronization from SC Wiki API to database
type Syncer struct {
	client *Client
	db     *sql.DB
	driver string // "sqlite" or "postgres"
}

// NewSyncer creates a new syncer
func NewSyncer(client *Client, db *sql.DB, driver string) *Syncer {
	return &Syncer{
		client: client,
		db:     db,
		driver: driver,
	}
}

// prepareQuery converts SQLite placeholders to PostgreSQL if needed
func (s *Syncer) prepareQuery(query string) string {
	if s.driver == "postgres" {
		// Replace ? with $1, $2, $3, etc.
		var result strings.Builder
		count := 0
		for _, r := range query {
			if r == '?' {
				count++
				result.WriteString(fmt.Sprintf("$%d", count))
			} else {
				result.WriteRune(r)
			}
		}
		return result.String()
	}
	return query
}

// SyncAll syncs all endpoints in dependency order
func (s *Syncer) SyncAll(ctx context.Context) error {
	log.Info().Msg("starting full SC Wiki sync")
	start := time.Now()

	// Sync in dependency order: Manufacturers → Vehicles → Items
	// (Vehicles and Items reference manufacturers, Ports reference vehicles and items)
	if err := s.SyncManufacturers(ctx); err != nil {
		log.Error().Err(err).Msg("manufacturer sync failed")
		return fmt.Errorf("manufacturer sync failed: %w", err)
	}

	if err := s.SyncVehicles(ctx); err != nil {
		log.Error().Err(err).Msg("vehicle sync failed")
		return fmt.Errorf("vehicle sync failed: %w", err)
	}

	if err := s.SyncItems(ctx); err != nil {
		log.Error().Err(err).Msg("item sync failed")
		return fmt.Errorf("item sync failed: %w", err)
	}

	duration := time.Since(start)
	log.Info().Dur("duration", duration).Msg("SC Wiki sync complete")
	return nil
}

// SyncGameVersions syncs game versions
func (s *Syncer) SyncGameVersions(ctx context.Context) error {
	data, err := s.client.GetPaginated(ctx, "/api/game-versions")
	if err != nil {
		return err
	}

	count := 0
	var latestUpdate time.Time

	for i, raw := range data {
		var gv GameVersion
		if err := json.Unmarshal(raw, &gv); err != nil {
			log.Warn().
				Err(err).
				Int("record_index", i).
				RawJSON("raw_data", raw).
				Msg("failed to unmarshal game version")
			continue
		}

		if err := s.upsertGameVersion(&gv, raw); err != nil {
			log.Warn().
				Err(err).
				Str("uuid", gv.UUID).
				Str("code", gv.Code).
				Int("record_index", i).
				Msg("failed to upsert game version")
			continue
		}

		count++
		if gv.UpdatedAt.After(latestUpdate) {
			latestUpdate = gv.UpdatedAt
		}
	}

	s.updateSyncMetadata("game_versions", "success", count, "")
	log.Info().Int("count", count).Msg("game versions synced")
	return nil
}

// SyncManufacturers syncs manufacturers
func (s *Syncer) SyncManufacturers(ctx context.Context) error {
	data, err := s.client.GetPaginated(ctx, "/api/manufacturers")
	if err != nil {
		return err
	}

	count := 0
	for i, raw := range data {
		var m Manufacturer
		if err := json.Unmarshal(raw, &m); err != nil {
			log.Warn().
				Err(err).
				Int("record_index", i).
				RawJSON("raw_data", raw).
				Msg("failed to unmarshal manufacturer")
			continue
		}

		if err := s.upsertManufacturer(&m, raw); err != nil {
			log.Warn().
				Err(err).
				Str("uuid", m.UUID).
				Str("name", m.Name).
				Int("record_index", i).
				Msg("failed to upsert manufacturer")
			continue
		}
		count++
	}

	s.updateSyncMetadata("manufacturers", "success", count, "")
	log.Info().Int("count", count).Msg("manufacturers synced")
	return nil
}

// SyncVehicles syncs in-game vehicles with ports
func (s *Syncer) SyncVehicles(ctx context.Context) error {
	data, err := s.client.GetPaginated(ctx, "/api/vehicles?include=manufacturer,game_version,ports")
	if err != nil {
		return err
	}

	count := 0
	for i, raw := range data {
		var v Vehicle
		if err := json.Unmarshal(raw, &v); err != nil {
			log.Warn().
				Err(err).
				Int("record_index", i).
				RawJSON("raw_data", raw).
				Msg("failed to unmarshal vehicle")
			continue
		}

		// Parse full JSON for JSONB storage
		var fullData map[string]any
		json.Unmarshal(raw, &fullData)
		v.RawData = fullData

		if err := s.upsertVehicle(&v, raw); err != nil {
			log.Warn().
				Err(err).
				Str("uuid", v.UUID).
				Str("name", v.Name).
				Int("record_index", i).
				Msg("failed to upsert vehicle")
			continue
		}
		count++
	}

	s.updateSyncMetadata("vehicles", "success", count, "")
	log.Info().Int("count", count).Msg("vehicles synced")
	return nil
}

// SyncItems syncs in-game items (filtered to relevant types)
func (s *Syncer) SyncItems(ctx context.Context) error {
	data, err := s.client.GetPaginated(ctx, "/api/items?include=manufacturer,game_version")
	if err != nil {
		return err
	}

	count := 0
	for i, raw := range data {
		var item Item
		if err := json.Unmarshal(raw, &item); err != nil {
			log.Warn().
				Err(err).
				Int("record_index", i).
				RawJSON("raw_data", raw).
				Msg("failed to unmarshal item")
			continue
		}

		// Filter to relevant item types only
		if !isRelevantItemType(item.Type) {
			continue
		}

		var fullData map[string]any
		json.Unmarshal(raw, &fullData)
		item.RawData = fullData

		if err := s.upsertItem(&item, raw); err != nil {
			log.Warn().
				Err(err).
				Str("uuid", item.UUID).
				Str("name", item.Name).
				Int("record_index", i).
				Msg("failed to upsert item")
			continue
		}
		count++
	}

	s.updateSyncMetadata("items", "success", count, "")
	log.Info().Int("count", count).Msg("items synced")
	return nil
}

// isRelevantItemType filters items to ship components and FPS items
func isRelevantItemType(itemType string) bool {
	relevantTypes := map[string]bool{
		// Ship components
		"WeaponGun":                    true,
		"WeaponMissile":                true,
		"TurretBase":                   true,
		"PowerPlant":                   true,
		"Cooler":                       true,
		"QuantumDrive":                 true,
		"Shield":                       true,
		"ShieldGenerator":              true,
		"MainThruster":                 true,
		"ManneuverThruster":            true,
		"QuantumInterdictionGenerator": true,
		"Radar":                        true,
		"Scanner":                      true,
		"Avionics":                     true,

		// FPS items
		"WeaponPersonal":   true,
		"Armor":            true,
		"Helmet":           true,
		"Undersuit":        true,
		"Backpack":         true,
		"MedPen":           true,
		"Gadget":           true,
		"WeaponAttachment": true,
		"Grenade":          true,
	}

	return relevantTypes[itemType]
}

// SyncShipMatrix syncs ship matrix vehicles
func (s *Syncer) SyncShipMatrix(ctx context.Context) error {
	data, err := s.client.GetPaginated(ctx, "/api/shipmatrix/vehicles")
	if err != nil {
		return err
	}

	count := 0
	for i, raw := range data {
		var smv ShipMatrixVehicle
		if err := json.Unmarshal(raw, &smv); err != nil {
			log.Warn().
				Err(err).
				Int("record_index", i).
				RawJSON("raw_data", raw).
				Msg("failed to unmarshal shipmatrix vehicle")
			continue
		}

		if err := s.upsertShipMatrixVehicle(&smv, raw); err != nil {
			log.Warn().
				Err(err).
				Str("uuid", smv.UUID).
				Str("name", smv.Name).
				Int("record_index", i).
				Msg("failed to upsert shipmatrix vehicle")
			continue
		}
		count++
	}

	s.updateSyncMetadata("shipmatrix", "success", count, "")
	log.Info().Int("count", count).Msg("shipmatrix vehicles synced")
	return nil
}

// Placeholder sync functions for other endpoints
func (s *Syncer) SyncCommLinks(ctx context.Context) error {
	log.Info().Msg("comm links sync not yet implemented")
	return nil
}

func (s *Syncer) SyncGalactapedia(ctx context.Context) error {
	log.Info().Msg("galactapedia sync not yet implemented")
	return nil
}

func (s *Syncer) SyncCelestialObjects(ctx context.Context) error {
	log.Info().Msg("celestial objects sync not yet implemented")
	return nil
}

func (s *Syncer) SyncStarsystems(ctx context.Context) error {
	log.Info().Msg("starsystems sync not yet implemented")
	return nil
}

// Database upsert functions

func (s *Syncer) upsertGameVersion(gv *GameVersion, rawJSON json.RawMessage) error {
	// Validate JSON
	if !json.Valid(rawJSON) {
		return fmt.Errorf("invalid JSON data for game version %s", gv.UUID)
	}

	var query string
	if s.driver == "postgres" {
		query = `
			INSERT INTO sc_game_versions
			(uuid, code, channel, is_default, released_at, data, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT(uuid) DO UPDATE SET
				code = EXCLUDED.code,
				channel = EXCLUDED.channel,
				is_default = EXCLUDED.is_default,
				released_at = EXCLUDED.released_at,
				data = EXCLUDED.data,
				updated_at = EXCLUDED.updated_at
		`
	} else {
		query = `
			INSERT OR REPLACE INTO sc_game_versions
			(uuid, code, channel, is_default, released_at, data, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`
	}

	_, err := s.db.Exec(query,
		gv.UUID, gv.Code, gv.Channel, gv.IsDefault,
		gv.ReleasedAt, string(rawJSON),
		gv.CreatedAt, gv.UpdatedAt,
	)
	return err
}

func (s *Syncer) upsertManufacturer(m *Manufacturer, rawJSON json.RawMessage) error {
	// Validate JSON
	if !json.Valid(rawJSON) {
		return fmt.Errorf("invalid JSON data for manufacturer %s", m.UUID)
	}

	var query string
	if s.driver == "postgres" {
		query = `
			INSERT INTO sc_manufacturers
			(uuid, name, slug, known_for, description, logo_url, data, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT(uuid) DO UPDATE SET
				name = EXCLUDED.name,
				slug = EXCLUDED.slug,
				known_for = EXCLUDED.known_for,
				description = EXCLUDED.description,
				logo_url = EXCLUDED.logo_url,
				data = EXCLUDED.data,
				updated_at = EXCLUDED.updated_at
		`
	} else {
		query = `
			INSERT OR REPLACE INTO sc_manufacturers
			(uuid, name, slug, known_for, description, logo_url, data, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`
	}

	_, err := s.db.Exec(query,
		m.UUID, m.Name, m.Slug, m.KnownFor, m.Description, m.LogoURL,
		string(rawJSON), m.CreatedAt, m.UpdatedAt,
	)
	return err
}

func (s *Syncer) upsertVehicle(v *Vehicle, rawJSON json.RawMessage) error {
	// Validate JSON
	if !json.Valid(rawJSON) {
		return fmt.Errorf("invalid JSON data for vehicle %s", v.UUID)
	}

	var manufacturerID *int
	var gameVersionID *int

	// Look up manufacturer ID
	if v.Manufacturer != nil {
		var id int
		lookupQuery := s.prepareQuery("SELECT id FROM sc_manufacturers WHERE uuid = ?")
		err := s.db.QueryRow(lookupQuery, v.Manufacturer.UUID).Scan(&id)
		if err == nil {
			manufacturerID = &id
		}
	}

	// Look up game version ID
	if v.GameVersion != nil {
		var id int
		lookupQuery := s.prepareQuery("SELECT id FROM sc_game_versions WHERE uuid = ?")
		err := s.db.QueryRow(lookupQuery, v.GameVersion.UUID).Scan(&id)
		if err == nil {
			gameVersionID = &id
		}
	}

	// Extract crew and speed
	crewMin, crewMax := 0, 0
	if v.Crew != nil {
		crewMin, crewMax = v.Crew.Min, v.Crew.Max
	}

	speedMax := 0.0
	if v.Speed != nil {
		speedMax = v.Speed.Max
	}

	var query string
	if s.driver == "postgres" {
		query = `
			INSERT INTO sc_vehicles
			(uuid, class_name, name, slug, manufacturer_id, size, size_class, career, role,
			 is_vehicle, is_gravlev, is_spaceship, mass_total, cargo_capacity, vehicle_inventory,
			 crew_min, crew_max, speed_max, game_version_id, data, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
			ON CONFLICT(uuid) DO UPDATE SET
				class_name = EXCLUDED.class_name,
				name = EXCLUDED.name,
				slug = EXCLUDED.slug,
				manufacturer_id = EXCLUDED.manufacturer_id,
				size = EXCLUDED.size,
				size_class = EXCLUDED.size_class,
				career = EXCLUDED.career,
				role = EXCLUDED.role,
				is_vehicle = EXCLUDED.is_vehicle,
				is_gravlev = EXCLUDED.is_gravlev,
				is_spaceship = EXCLUDED.is_spaceship,
				mass_total = EXCLUDED.mass_total,
				cargo_capacity = EXCLUDED.cargo_capacity,
				vehicle_inventory = EXCLUDED.vehicle_inventory,
				crew_min = EXCLUDED.crew_min,
				crew_max = EXCLUDED.crew_max,
				speed_max = EXCLUDED.speed_max,
				game_version_id = EXCLUDED.game_version_id,
				data = EXCLUDED.data,
				updated_at = EXCLUDED.updated_at
		`
	} else {
		query = `
			INSERT OR REPLACE INTO sc_vehicles
			(uuid, class_name, name, slug, manufacturer_id, size, size_class, career, role,
			 is_vehicle, is_gravlev, is_spaceship, mass_total, cargo_capacity, vehicle_inventory,
			 crew_min, crew_max, speed_max, game_version_id, data, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`
	}

	_, err := s.db.Exec(query,
		v.UUID, v.ClassName, v.Name, v.Slug, manufacturerID,
		v.Size, v.SizeClass, v.Career, v.Role,
		v.IsVehicle, v.IsGravlev, v.IsSpaceship,
		v.MassTotal, v.CargoCapacity, v.VehicleInventory,
		crewMin, crewMax, speedMax,
		gameVersionID, string(rawJSON),
		v.CreatedAt, v.UpdatedAt,
	)
	if err != nil {
		return err
	}

	// Upsert ports if included
	if v.Ports != nil {
		for _, port := range *v.Ports {
			if err := s.upsertPort(&port, v.UUID); err != nil {
				log.Warn().Err(err).Str("vehicle_uuid", v.UUID).Str("port_name", port.Name).Msg("upsert port failed")
			}
		}
	}

	return nil
}

func (s *Syncer) upsertPort(port *Port, vehicleUUID string) error {
	// Resolve equipped item UUID to ID if present
	var equippedItemUUID *string
	if port.EquippedItem != nil {
		equippedItemUUID = &port.EquippedItem.UUID
	}

	var query string
	if s.driver == "postgres" {
		query = `
			INSERT INTO sc_ports
			(uuid, vehicle_uuid, name, category_label, size_min, size_max, port_type, equipped_item_uuid)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (uuid) DO UPDATE SET
				name = EXCLUDED.name,
				category_label = EXCLUDED.category_label,
				size_min = EXCLUDED.size_min,
				size_max = EXCLUDED.size_max,
				port_type = EXCLUDED.port_type,
				equipped_item_uuid = EXCLUDED.equipped_item_uuid
		`
	} else {
		query = `
			INSERT OR REPLACE INTO sc_ports
			(uuid, vehicle_uuid, name, category_label, size_min, size_max, port_type, equipped_item_uuid)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`
	}

	_, err := s.db.Exec(query,
		port.UUID, vehicleUUID, port.Name, port.CategoryLabel,
		port.SizeMin, port.SizeMax, port.PortType, equippedItemUUID,
	)
	return err
}

func (s *Syncer) upsertItem(item *Item, rawJSON json.RawMessage) error {
	// Validate JSON
	if !json.Valid(rawJSON) {
		return fmt.Errorf("invalid JSON data for item %s", item.UUID)
	}

	var manufacturerID *int
	var gameVersionID *int

	if item.Manufacturer != nil {
		var id int
		lookupQuery := s.prepareQuery("SELECT id FROM sc_manufacturers WHERE uuid = ?")
		err := s.db.QueryRow(lookupQuery, item.Manufacturer.UUID).Scan(&id)
		if err == nil {
			manufacturerID = &id
		}
	}

	if item.GameVersion != nil {
		var id int
		lookupQuery := s.prepareQuery("SELECT id FROM sc_game_versions WHERE uuid = ?")
		err := s.db.QueryRow(lookupQuery, item.GameVersion.UUID).Scan(&id)
		if err == nil {
			gameVersionID = &id
		}
	}

	var query string
	if s.driver == "postgres" {
		query = `
			INSERT INTO sc_items
			(uuid, class_name, name, slug, manufacturer_id, type, sub_type, size, grade,
			 game_version_id, data, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
			ON CONFLICT(uuid) DO UPDATE SET
				class_name = EXCLUDED.class_name,
				name = EXCLUDED.name,
				slug = EXCLUDED.slug,
				manufacturer_id = EXCLUDED.manufacturer_id,
				type = EXCLUDED.type,
				sub_type = EXCLUDED.sub_type,
				size = EXCLUDED.size,
				grade = EXCLUDED.grade,
				game_version_id = EXCLUDED.game_version_id,
				data = EXCLUDED.data,
				updated_at = EXCLUDED.updated_at
		`
	} else {
		query = `
			INSERT OR REPLACE INTO sc_items
			(uuid, class_name, name, slug, manufacturer_id, type, sub_type, size, grade,
			 game_version_id, data, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`
	}

	_, err := s.db.Exec(query,
		item.UUID, item.ClassName, item.Name, item.Slug, manufacturerID,
		item.Type, item.SubType, item.Size, item.Grade,
		gameVersionID, string(rawJSON),
		item.CreatedAt, item.UpdatedAt,
	)
	return err
}

func (s *Syncer) upsertShipMatrixVehicle(smv *ShipMatrixVehicle, rawJSON json.RawMessage) error {
	// Validate JSON
	if !json.Valid(rawJSON) {
		return fmt.Errorf("invalid JSON data for ship matrix vehicle %s", smv.UUID)
	}

	var query string
	if s.driver == "postgres" {
		query = `
			INSERT INTO sc_shipmatrix_vehicles
			(uuid, name, slug, pledge_price, price_auec, sc_vehicle_uuid, data, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT(uuid) DO UPDATE SET
				name = EXCLUDED.name,
				slug = EXCLUDED.slug,
				pledge_price = EXCLUDED.pledge_price,
				price_auec = EXCLUDED.price_auec,
				sc_vehicle_uuid = EXCLUDED.sc_vehicle_uuid,
				data = EXCLUDED.data,
				updated_at = EXCLUDED.updated_at
		`
	} else {
		query = `
			INSERT OR REPLACE INTO sc_shipmatrix_vehicles
			(uuid, name, slug, pledge_price, price_auec, sc_vehicle_uuid, data, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`
	}

	_, err := s.db.Exec(query,
		smv.UUID, smv.Name, smv.Slug, smv.PledgePrice, smv.PriceAUEC,
		smv.SCVehicleUUID, string(rawJSON),
		smv.CreatedAt, smv.UpdatedAt,
	)
	return err
}

func (s *Syncer) updateSyncMetadata(endpoint, status string, count int, errMsg string) {
	var query string
	if s.driver == "postgres" {
		query = `
			INSERT INTO sc_sync_metadata
			(endpoint, last_sync_at, total_records, sync_status, error_message, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
			ON CONFLICT(endpoint) DO UPDATE SET
				last_sync_at = EXCLUDED.last_sync_at,
				total_records = EXCLUDED.total_records,
				sync_status = EXCLUDED.sync_status,
				error_message = EXCLUDED.error_message,
				updated_at = NOW()
		`
	} else {
		query = `
			INSERT OR REPLACE INTO sc_sync_metadata
			(endpoint, last_sync_at, total_records, sync_status, error_message, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
		`
	}
	s.db.Exec(query, endpoint, time.Now(), count, status, errMsg)
}
