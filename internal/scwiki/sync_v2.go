// +build ignore

package scwiki

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// SyncClientV2 handles syncing from scunpacked-data repository
type SyncClientV2 struct {
	db       *sql.DB
	driver   string // "sqlite" or "postgres"
	repoPath string
}

// NewSyncClientV2 creates a new V2 sync client
func NewSyncClientV2(db *sql.DB, driver, repoPath string) *SyncClientV2 {
	return &SyncClientV2{
		db:       db,
		driver:   driver,
		repoPath: repoPath,
	}
}

// SyncAll syncs all categories from scunpacked-data
func (s *SyncClientV2) SyncAll(ctx context.Context) error {
	log.Info().Str("repo", s.repoPath).Msg("starting SC Wiki V2 sync from scunpacked-data")

	// Sync in dependency order
	if err := s.SyncManufacturers(ctx); err != nil {
		return fmt.Errorf("sync manufacturers: %w", err)
	}

	if err := s.SyncVehicles(ctx); err != nil {
		return fmt.Errorf("sync vehicles: %w", err)
	}

	if err := s.SyncItems(ctx); err != nil {
		return fmt.Errorf("sync items: %w", err)
	}

	log.Info().Msg("SC Wiki V2 sync complete")
	return nil
}

// SyncManufacturers syncs manufacturers from manufacturers.json
func (s *SyncClientV2) SyncManufacturers(ctx context.Context) error {
	log.Info().Msg("syncing manufacturers from manufacturers.json")

	filePath := filepath.Join(s.repoPath, "manufacturers.json")
	checksum, err := s.fileChecksum(filePath)
	if err != nil {
		return err
	}

	// Check if already synced
	if s.isAlreadySynced(ctx, "manufacturers", checksum) {
		log.Info().Msg("manufacturers already up to date")
		return nil
	}

	// Read file
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("read manufacturers.json: %w", err)
	}

	var manufacturers []ManufacturerV2
	if err := json.Unmarshal(data, &manufacturers); err != nil {
		return fmt.Errorf("unmarshal manufacturers: %w", err)
	}

	// Begin transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Clear existing data
	if _, err := tx.ExecContext(ctx, "DELETE FROM manufacturers"); err != nil {
		return fmt.Errorf("delete manufacturers: %w", err)
	}

	// Prepare insert statement
	insertQuery := s.prepareQuery(`
		INSERT INTO manufacturers (uuid, name, code, known_for, description)
		VALUES (?, ?, ?, ?, ?)
	`)
	stmt, err := tx.PrepareContext(ctx, insertQuery)
	if err != nil {
		return err
	}
	defer stmt.Close()

	count := 0
	for _, m := range manufacturers {
		if m.Reference == "" || m.Code == "" {
			continue // Skip invalid entries
		}

		_, err := stmt.ExecContext(ctx, m.Reference, m.Name, m.Code, "", "")
		if err != nil {
			log.Warn().Err(err).Str("manufacturer", m.Name).Msg("failed to insert manufacturer")
			continue
		}
		count++
	}

	// Update sync status
	if err := s.updateSyncStatus(ctx, tx, "manufacturers", checksum, count); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	log.Info().Int("count", count).Msg("manufacturers synced")
	return nil
}

// SyncVehicles syncs ships from ships/*.json
func (s *SyncClientV2) SyncVehicles(ctx context.Context) error {
	log.Info().Msg("syncing vehicles from ships/*.json")

	shipsDir := filepath.Join(s.repoPath, "ships")
	checksum, err := s.dirChecksum(shipsDir)
	if err != nil {
		return err
	}

	// Check if already synced
	if s.isAlreadySynced(ctx, "vehicles", checksum) {
		log.Info().Msg("vehicles already up to date")
		return nil
	}

	// Find all ship JSON files
	files, err := filepath.Glob(filepath.Join(shipsDir, "*.json"))
	if err != nil {
		return fmt.Errorf("glob ships: %w", err)
	}

	// Begin transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Clear existing data (cascade will handle loaners and ports)
	if _, err := tx.ExecContext(ctx, "DELETE FROM sc_vehicle_loaners"); err != nil {
		return fmt.Errorf("delete loaners: %w", err)
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM sc_ports"); err != nil {
		return fmt.Errorf("delete ports: %w", err)
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM sc_vehicles_v2"); err != nil {
		return fmt.Errorf("delete vehicles: %w", err)
	}

	vehicleCount := 0
	portCount := 0
	loanerCount := 0

	for _, filePath := range files {
		data, err := os.ReadFile(filePath)
		if err != nil {
			log.Warn().Err(err).Str("file", filePath).Msg("failed to read ship file")
			continue
		}

		var vehicle VehicleV2
		if err := json.Unmarshal(data, &vehicle); err != nil {
			log.Warn().Err(err).Str("file", filePath).Msg("failed to unmarshal ship")
			continue
		}

		// Insert vehicle
		if err := s.insertVehicle(ctx, tx, &vehicle); err != nil {
			log.Warn().Err(err).Str("vehicle", vehicle.Name).Msg("failed to insert vehicle")
			continue
		}
		vehicleCount++

		// Insert ports recursively from Loadout
		if len(vehicle.Loadout) > 0 {
			ports := s.extractPorts(ctx, tx, vehicle.UUID, nil, vehicle.Loadout)
			portCount += ports
		}

		// Loaners not available in V2 model - skip
		/*
		if len(vehicle.Loaners) > 0 {
			for _, loaner := range vehicle.Loaners {
				if loaner.UUID == "" {
					continue
				}

				loanerQuery := s.prepareQuery(`
					INSERT INTO sc_vehicle_loaners (vehicle_uuid, loaner_uuid)
					VALUES (?, ?)
				`)

				if s.driver == "postgres" {
					loanerQuery += " ON CONFLICT DO NOTHING"
				} else {
					loanerQuery = s.prepareQuery(`
						INSERT OR IGNORE INTO sc_vehicle_loaners (vehicle_uuid, loaner_uuid)
						VALUES (?, ?)
					`)
				}

				_, err := tx.ExecContext(ctx, loanerQuery, vehicle.UUID, loaner.UUID)
				if err != nil {
					log.Warn().Err(err).Str("vehicle", vehicle.Name).Msg("failed to insert loaner")
					continue
				}
				loanerCount++
			}
		}
		*/
	}

	// Update sync status
	if err := s.updateSyncStatus(ctx, tx, "vehicles", checksum, vehicleCount); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	log.Info().
		Int("vehicles", vehicleCount).
		Int("ports", portCount).
		Int("loaners", loanerCount).
		Msg("vehicles synced")
	return nil
}

// SyncItems syncs ship items and FPS items
func (s *SyncClientV2) SyncItems(ctx context.Context) error {
	log.Info().Msg("syncing items from ship-items.json and fps-items.json")

	shipItemsPath := filepath.Join(s.repoPath, "ship-items.json")
	fpsItemsPath := filepath.Join(s.repoPath, "fps-items.json")

	// Calculate combined checksum
	h1, err := s.fileChecksum(shipItemsPath)
	if err != nil {
		return err
	}
	h2, err := s.fileChecksum(fpsItemsPath)
	if err != nil {
		return err
	}
	checksum := fmt.Sprintf("%s-%s", h1, h2)

	// Check if already synced
	if s.isAlreadySynced(ctx, "items", checksum) {
		log.Info().Msg("items already up to date")
		return nil
	}

	// Begin transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Clear existing data
	if _, err := tx.ExecContext(ctx, "DELETE FROM sc_items_v2"); err != nil {
		return fmt.Errorf("delete items: %w", err)
	}

	count := 0

	// Sync ship items
	shipCount, err := s.syncItemsFromFile(ctx, tx, shipItemsPath, ShipItemTypes)
	if err != nil {
		return fmt.Errorf("sync ship items: %w", err)
	}
	count += shipCount

	// Sync FPS items
	fpsCount, err := s.syncItemsFromFile(ctx, tx, fpsItemsPath, FPSItemTypes)
	if err != nil {
		return fmt.Errorf("sync fps items: %w", err)
	}
	count += fpsCount

	// Update sync status
	if err := s.updateSyncStatus(ctx, tx, "items", checksum, count); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	log.Info().
		Int("ship_items", shipCount).
		Int("fps_items", fpsCount).
		Int("total", count).
		Msg("items synced")
	return nil
}

// Helper functions

func (s *SyncClientV2) insertVehicle(ctx context.Context, tx *sql.Tx, v *VehicleV2) error {
	query := s.prepareQuery(`
		INSERT INTO sc_vehicles_v2 (
			uuid, name, class_name, manufacturer_uuid,
			size_class, focus, type, is_spaceship, is_vehicle, is_gravlev,
			production_status, length, width, height,
			mass_hull, mass_loadout, mass_total,
			cargo_capacity, vehicle_inventory,
			crew_min, crew_max, crew_weapon,
			health, speed_scm, speed_max,
			agility_pitch, agility_yaw, agility_roll,
			shield_hp, shield_regen, shield_face_type,
			game_version
		) VALUES (
			?, ?, ?, ?,
			?, ?, ?, ?, ?, ?,
			?, ?, ?, ?,
			?, ?, ?,
			?, ?,
			?, ?, ?,
			?, ?, ?,
			?, ?, ?,
			?, ?, ?,
			?
		)
	`)

	_, err := tx.ExecContext(ctx, query,
		v.UUID, v.Name, v.ClassName, v.Manufacturer.UUID,
		v.Size.SizeClass, v.Focus, v.Type, v.IsSpaceship, v.IsVehicle, v.IsGravlev,
		v.ProductionStatus, v.Length, v.Width, v.Height,
		v.Mass.Hull, v.Mass.Loadout, v.Mass.Total,
		v.CargoCapacity, v.VehicleInventory,
		v.Crew.Min, v.Crew.Max, v.Crew.Weapon,
		v.Health, v.Speed.SCM, v.Speed.Max,
		v.Agility.Pitch, v.Agility.Yaw, v.Agility.Roll,
		v.Shield.HP, v.Shield.Regen, v.Shield.FaceType,
		v.GameVersion,
	)
	return err
}

func (s *SyncClientV2) extractPorts(ctx context.Context, tx *sql.Tx, vehicleUUID string, parentPortID *int64, ports []PortV2) int {
	count := 0
	for _, port := range ports {
		// Get equipped item UUID (may be empty)
		equippedItemUUID := sql.NullString{}
		if port.EquippedItem.UUID != "" {
			equippedItemUUID.Valid = true
			equippedItemUUID.String = port.EquippedItem.UUID
		}

		// Get parent port ID
		parentID := sql.NullInt64{}
		if parentPortID != nil {
			parentID.Valid = true
			parentID.Int64 = *parentPortID
		}

		// Insert port
		query := s.prepareQuery(`
			INSERT INTO sc_ports (
				uuid, vehicle_uuid, parent_port_id,
				name, position, category_label,
				size_min, size_max, port_type, port_subtype,
				class_name, equipped_item_uuid,
				editable, editable_children, health
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)

		result, err := tx.ExecContext(ctx, query,
			port.UUID, vehicleUUID, parentID,
			port.Name, port.Position, port.CategoryLabel,
			port.SizeMin, port.SizeMax, port.PortType, port.PortSubtype,
			port.ClassName, equippedItemUUID,
			port.Editable, port.EditableChildren, port.Health,
		)
		if err != nil {
			log.Warn().Err(err).Str("port", port.Name).Msg("failed to insert port")
			continue
		}
		count++

		// Get inserted port ID
		portID, err := result.LastInsertId()
		if err != nil {
			log.Warn().Err(err).Str("port", port.Name).Msg("failed to get port ID")
			continue
		}

		// Recursively insert child ports
		if len(port.Ports) > 0 {
			childCount := s.extractPorts(ctx, tx, vehicleUUID, &portID, port.Ports)
			count += childCount
		}
	}
	return count
}

func (s *SyncClientV2) syncItemsFromFile(ctx context.Context, tx *sql.Tx, filePath string, allowedTypes map[string]bool) (int, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return 0, fmt.Errorf("read %s: %w", filePath, err)
	}

	var items []ItemV2
	if err := json.Unmarshal(data, &items); err != nil {
		return 0, fmt.Errorf("unmarshal items: %w", err)
	}

	query := s.prepareQuery(`
		INSERT INTO sc_items_v2 (
			uuid, name, class_name, manufacturer_uuid,
			type, sub_type, classification, size, grade, class,
			width, height, length, mass, volume_scu,
			description, metadata, is_base_variant, tags, game_version
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)

	stmt, err := tx.PrepareContext(ctx, query)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	count := 0
	for _, item := range items {
		// Filter by type
		if !allowedTypes[item.Type] {
			continue
		}

		if item.UUID == "" {
			continue
		}

		// Serialize metadata to JSON
		metadataJSON, _ := json.Marshal(item.Metadata)

		// Join tags
		tagsStr := strings.Join(item.Tags, ",")

		_, err := stmt.ExecContext(ctx,
			item.UUID, item.Name, item.ClassName, item.Manufacturer.UUID,
			item.Type, item.SubType, item.Classification, item.Size, item.Grade, item.Class,
			item.Width, item.Height, item.Length, item.Mass, item.VolumeSCU,
			item.Description, string(metadataJSON), item.IsBaseVariant, tagsStr, item.GameVersion,
		)
		if err != nil {
			log.Warn().Err(err).Str("item", item.Name).Msg("failed to insert item")
			continue
		}
		count++
	}

	return count, nil
}

// Utility functions

func (s *SyncClientV2) prepareQuery(query string) string {
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

func (s *SyncClientV2) fileChecksum(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}

	return fmt.Sprintf("%x", h.Sum(nil)), nil
}

func (s *SyncClientV2) dirChecksum(path string) (string, error) {
	files, err := filepath.Glob(filepath.Join(path, "*.json"))
	if err != nil {
		return "", err
	}

	h := sha256.New()
	for _, file := range files {
		checksum, err := s.fileChecksum(file)
		if err != nil {
			return "", err
		}
		h.Write([]byte(checksum))
	}

	return fmt.Sprintf("%x", h.Sum(nil)), nil
}

func (s *SyncClientV2) isAlreadySynced(ctx context.Context, category, checksum string) bool {
	var existingChecksum string
	query := s.prepareQuery(`
		SELECT file_checksum FROM sc_sync_status
		WHERE category = ? AND status = 'success'
	`)
	err := s.db.QueryRowContext(ctx, query, category).Scan(&existingChecksum)

	if err != nil {
		return false
	}

	return existingChecksum == checksum
}

func (s *SyncClientV2) updateSyncStatus(ctx context.Context, tx *sql.Tx, category, checksum string, count int) error {
	var query string
	if s.driver == "postgres" {
		query = `
			INSERT INTO sc_sync_status (category, last_synced_at, file_checksum, status, records_synced)
			VALUES ($1, $2, $3, 'success', $4)
			ON CONFLICT(category) DO UPDATE SET
				last_synced_at = EXCLUDED.last_synced_at,
				file_checksum = EXCLUDED.file_checksum,
				status = EXCLUDED.status,
				records_synced = EXCLUDED.records_synced,
				error_message = NULL
		`
	} else {
		query = `
			INSERT OR REPLACE INTO sc_sync_status (category, last_synced_at, file_checksum, status, records_synced, error_message)
			VALUES (?, ?, ?, 'success', ?, NULL)
		`
	}

	_, err := tx.ExecContext(ctx, query, category, time.Now(), checksum, count)
	return err
}
