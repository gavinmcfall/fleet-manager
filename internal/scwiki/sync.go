package scwiki

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/nzvengeance/fleet-manager/internal/database"
	"github.com/nzvengeance/fleet-manager/internal/models"
	"github.com/rs/zerolog/log"
)

// Syncer handles synchronization from SC Wiki API to database
type Syncer struct {
	client *Client
	db     *database.DB
}

// NewSyncer creates a new syncer
func NewSyncer(client *Client, db *database.DB) *Syncer {
	return &Syncer{
		client: client,
		db:     db,
	}
}

// SyncAll syncs all endpoints in dependency order
func (s *Syncer) SyncAll(ctx context.Context) error {
	log.Info().Msg("starting full SC Wiki sync")
	start := time.Now()

	// Sync in dependency order: Manufacturers -> Game Versions -> Vehicles -> Items
	if err := s.SyncManufacturers(ctx); err != nil {
		log.Error().Err(err).Msg("manufacturer sync failed")
		return fmt.Errorf("manufacturer sync failed: %w", err)
	}

	if err := s.SyncGameVersions(ctx); err != nil {
		log.Error().Err(err).Msg("game version sync failed")
		// Non-fatal: vehicles can be synced without game versions
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

// SyncGameVersions syncs game versions into the game_versions table
func (s *Syncer) SyncGameVersions(ctx context.Context) error {
	syncID, _ := s.db.InsertSyncHistory(ctx, 1, "game_versions", "running") // 1 = scwiki

	data, err := s.client.GetPaginated(ctx, "/api/game-versions")
	if err != nil {
		s.db.UpdateSyncHistory(ctx, syncID, "error", 0, err.Error())
		return err
	}

	count := 0
	for i, raw := range data {
		var gv GameVersion
		if err := json.Unmarshal(raw, &gv); err != nil {
			log.Warn().Err(err).Int("record_index", i).Msg("failed to unmarshal game version")
			continue
		}

		model := &models.GameVersion{
			UUID:      gv.UUID,
			Code:      gv.Code,
			Channel:   gv.Channel,
			IsDefault: gv.IsDefault,
		}
		if !gv.ReleasedAt.IsZero() {
			model.ReleasedAt = &gv.ReleasedAt
		}

		if _, err := s.db.UpsertGameVersion(ctx, model); err != nil {
			log.Warn().Err(err).Str("uuid", gv.UUID).Str("code", gv.Code).Msg("failed to upsert game version")
			continue
		}
		count++
	}

	s.db.UpdateSyncHistory(ctx, syncID, "success", count, "")
	log.Info().Int("count", count).Msg("game versions synced")
	return nil
}

// SyncManufacturers syncs manufacturers into the manufacturers table
func (s *Syncer) SyncManufacturers(ctx context.Context) error {
	syncID, _ := s.db.InsertSyncHistory(ctx, 1, "manufacturers", "running") // 1 = scwiki

	data, err := s.client.GetPaginated(ctx, "/api/manufacturers")
	if err != nil {
		s.db.UpdateSyncHistory(ctx, syncID, "error", 0, err.Error())
		return err
	}

	count := 0
	for i, raw := range data {
		var m Manufacturer
		if err := json.Unmarshal(raw, &m); err != nil {
			log.Warn().Err(err).Int("record_index", i).Msg("failed to unmarshal manufacturer")
			continue
		}

		model := &models.Manufacturer{
			UUID:        m.UUID,
			Name:        m.Name,
			Code:        m.Code,
			Slug:        m.Slug,
			KnownFor:    m.KnownFor,
			Description: m.Description,
			LogoURL:     m.LogoURL,
			RawData:     string(raw),
		}

		if _, err := s.db.UpsertManufacturer(ctx, model); err != nil {
			log.Warn().Err(err).Str("uuid", m.UUID).Str("name", m.Name).Msg("failed to upsert manufacturer")
			continue
		}
		count++
	}

	s.db.UpdateSyncHistory(ctx, syncID, "success", count, "")
	log.Info().Int("count", count).Msg("manufacturers synced")
	return nil
}

// SyncVehicles syncs in-game vehicles with ports into the unified vehicles and ports tables
func (s *Syncer) SyncVehicles(ctx context.Context) error {
	syncID, _ := s.db.InsertSyncHistory(ctx, 1, "vehicles", "running") // 1 = scwiki

	data, err := s.client.GetPaginated(ctx, "/api/vehicles?include=manufacturer,game_version,ports")
	if err != nil {
		s.db.UpdateSyncHistory(ctx, syncID, "error", 0, err.Error())
		return err
	}

	count := 0
	for i, raw := range data {
		var v Vehicle
		if err := json.Unmarshal(raw, &v); err != nil {
			log.Warn().Err(err).Int("record_index", i).Msg("failed to unmarshal vehicle")
			continue
		}

		// Resolve manufacturer ID (try UUID first, then name fallback)
		var manufacturerID *int
		if v.Manufacturer != nil {
			id, err := s.db.GetManufacturerIDByUUID(ctx, v.Manufacturer.UUID)
			if err == nil {
				manufacturerID = &id
			} else if v.Manufacturer.Name != "" {
				id, err = s.db.GetManufacturerIDByName(ctx, v.Manufacturer.Name)
				if err == nil {
					manufacturerID = &id
				}
			}
		}

		// Resolve game version ID
		var gameVersionID *int
		if v.GameVersion != nil {
			id, err := s.db.GetGameVersionIDByUUID(ctx, v.GameVersion.UUID)
			if err == nil {
				gameVersionID = &id
			}
		}

		// Extract crew
		crewMin, crewMax := 0, 0
		if v.Crew != nil {
			crewMin, crewMax = v.Crew.Min, v.Crew.Max
		}

		// Extract speed
		speedSCM, speedMax := 0.0, 0.0
		if v.Speed != nil {
			speedSCM = v.Speed.SCM
			speedMax = v.Speed.Max
		}

		// Determine vehicle type
		var vehicleTypeID *int
		switch {
		case v.IsSpaceship:
			id := 1 // spaceship
			vehicleTypeID = &id
		case v.IsGravlev:
			id := 3 // gravlev
			vehicleTypeID = &id
		case v.IsVehicle:
			id := 2 // ground_vehicle
			vehicleTypeID = &id
		}

		model := &models.Vehicle{
			UUID:             v.UUID,
			Slug:             v.Slug,
			Name:             v.Name,
			ClassName:        v.ClassName,
			ManufacturerID:   manufacturerID,
			VehicleTypeID:    vehicleTypeID,
			Focus:            v.Role,
			Classification:   v.Career,
			Mass:             v.MassTotal,
			Cargo:            v.CargoCapacity,
			VehicleInventory: v.VehicleInventory,
			CrewMin:          crewMin,
			CrewMax:          crewMax,
			SpeedSCM:         speedSCM,
			SpeedMax:         speedMax,
			GameVersionID:    gameVersionID,
			RawData:          string(raw),
		}

		vehicleID, err := s.db.UpsertVehicle(ctx, model)
		if err != nil {
			log.Warn().Err(err).Str("uuid", v.UUID).Str("name", v.Name).Msg("failed to upsert vehicle")
			continue
		}

		// Upsert ports if included
		if v.Ports != nil {
			for _, port := range *v.Ports {
				var equippedItemUUID string
				if port.EquippedItem != nil {
					equippedItemUUID = port.EquippedItem.UUID
				}

				portModel := &models.Port{
					UUID:             port.UUID,
					VehicleID:        vehicleID,
					Name:             port.Name,
					CategoryLabel:    port.CategoryLabel,
					SizeMin:          port.SizeMin,
					SizeMax:          port.SizeMax,
					PortType:         port.PortType,
					EquippedItemUUID: equippedItemUUID,
				}
				if err := s.db.UpsertPort(ctx, portModel); err != nil {
					log.Warn().Err(err).Str("vehicle", v.Name).Str("port", port.Name).Msg("upsert port failed")
				}
			}
		}

		count++
	}

	s.db.UpdateSyncHistory(ctx, syncID, "success", count, "")
	log.Info().Int("count", count).Msg("vehicles synced")
	return nil
}

// SyncItems syncs in-game items, routing them to the correct table based on type
func (s *Syncer) SyncItems(ctx context.Context) error {
	syncID, _ := s.db.InsertSyncHistory(ctx, 1, "items", "running") // 1 = scwiki

	data, err := s.client.GetPaginated(ctx, "/api/items?include=manufacturer,game_version")
	if err != nil {
		s.db.UpdateSyncHistory(ctx, syncID, "error", 0, err.Error())
		return err
	}

	count := 0
	for i, raw := range data {
		var item Item
		if err := json.Unmarshal(raw, &item); err != nil {
			log.Warn().Err(err).Int("record_index", i).Msg("failed to unmarshal item")
			continue
		}

		if !isRelevantItemType(item.Type) {
			continue
		}

		// Resolve manufacturer ID (try UUID first, then name fallback)
		var manufacturerID *int
		if item.Manufacturer != nil {
			id, err := s.db.GetManufacturerIDByUUID(ctx, item.Manufacturer.UUID)
			if err == nil {
				manufacturerID = &id
			} else if item.Manufacturer.Name != "" {
				id, err = s.db.GetManufacturerIDByName(ctx, item.Manufacturer.Name)
				if err == nil {
					manufacturerID = &id
				}
			}
		}

		// Resolve game version ID
		var gameVersionID *int
		if item.GameVersion != nil {
			id, err := s.db.GetGameVersionIDByUUID(ctx, item.GameVersion.UUID)
			if err == nil {
				gameVersionID = &id
			}
		}

		rawData := string(raw)

		// Route item to the correct table based on type
		if err := s.routeItem(ctx, &item, manufacturerID, gameVersionID, rawData); err != nil {
			log.Warn().Err(err).Str("uuid", item.UUID).Str("name", item.Name).Str("type", item.Type).Msg("failed to upsert item")
			continue
		}
		count++
	}

	s.db.UpdateSyncHistory(ctx, syncID, "success", count, "")
	log.Info().Int("count", count).Msg("items synced")
	return nil
}

// routeItem sends an item to the correct table based on its type
func (s *Syncer) routeItem(ctx context.Context, item *Item, manufacturerID, gameVersionID *int, rawData string) error {
	switch {
	case isShipComponent(item.Type):
		return s.db.UpsertComponent(ctx, &models.Component{
			UUID:           item.UUID,
			Name:           item.Name,
			Slug:           item.Slug,
			ClassName:      item.ClassName,
			ManufacturerID: manufacturerID,
			Type:           item.Type,
			SubType:        item.SubType,
			Size:           item.Size,
			Grade:          string(item.Grade),
			GameVersionID:  gameVersionID,
			RawData:        rawData,
		})

	case item.Type == "WeaponPersonal":
		return s.db.UpsertFPSWeapon(ctx, &models.FPSWeapon{
			UUID:           item.UUID,
			Name:           item.Name,
			Slug:           item.Slug,
			ClassName:      item.ClassName,
			ManufacturerID: manufacturerID,
			SubType:        item.SubType,
			Size:           item.Size,
			GameVersionID:  gameVersionID,
			RawData:        rawData,
		})

	case isFPSArmour(item.Type):
		return s.db.UpsertFPSArmour(ctx, &models.FPSArmour{
			UUID:           item.UUID,
			Name:           item.Name,
			Slug:           item.Slug,
			ClassName:      item.ClassName,
			ManufacturerID: manufacturerID,
			SubType:        item.SubType,
			Size:           item.Size,
			Grade:          string(item.Grade),
			GameVersionID:  gameVersionID,
			RawData:        rawData,
		})

	case item.Type == "WeaponAttachment":
		return s.db.UpsertFPSAttachment(ctx, &models.FPSAttachment{
			UUID:           item.UUID,
			Name:           item.Name,
			Slug:           item.Slug,
			ClassName:      item.ClassName,
			ManufacturerID: manufacturerID,
			SubType:        item.SubType,
			Size:           item.Size,
			GameVersionID:  gameVersionID,
			RawData:        rawData,
		})

	case isFPSUtility(item.Type):
		return s.db.UpsertFPSUtility(ctx, &models.FPSUtility{
			UUID:           item.UUID,
			Name:           item.Name,
			Slug:           item.Slug,
			ClassName:      item.ClassName,
			ManufacturerID: manufacturerID,
			SubType:        item.SubType,
			GameVersionID:  gameVersionID,
			RawData:        rawData,
		})

	default:
		log.Debug().Str("type", item.Type).Str("name", item.Name).Msg("unrouted item type")
		return nil
	}
}

// isShipComponent returns true for ship-mountable components
func isShipComponent(itemType string) bool {
	components := map[string]bool{
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
	}
	return components[itemType]
}

// isFPSArmour returns true for FPS armour items
func isFPSArmour(itemType string) bool {
	return itemType == "Armor" || itemType == "Helmet" || itemType == "Undersuit"
}

// isFPSUtility returns true for FPS utility items
func isFPSUtility(itemType string) bool {
	utilities := map[string]bool{
		"MedPen":   true,
		"Gadget":   true,
		"Grenade":  true,
		"Backpack": true,
	}
	return utilities[itemType]
}

// isRelevantItemType filters items to ship components and FPS items
func isRelevantItemType(itemType string) bool {
	return isShipComponent(itemType) ||
		itemType == "WeaponPersonal" ||
		isFPSArmour(itemType) ||
		itemType == "WeaponAttachment" ||
		isFPSUtility(itemType)
}

