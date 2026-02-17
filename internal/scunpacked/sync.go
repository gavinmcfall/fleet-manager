package scunpacked

import (
	"context"
	"strings"

	"github.com/nzvengeance/fleet-manager/internal/database"
	"github.com/nzvengeance/fleet-manager/internal/models"
	"github.com/rs/zerolog/log"
)

// Syncer handles syncing scunpacked-data paint metadata to the database.
type Syncer struct {
	db       *database.DB
	dataPath string
}

// NewSyncer creates a new scunpacked paint syncer.
func NewSyncer(db *database.DB, dataPath string) *Syncer {
	return &Syncer{db: db, dataPath: dataPath}
}

// SyncPaints reads paint files from disk, resolves vehicle IDs, and upserts into the DB.
func (s *Syncer) SyncPaints(ctx context.Context) (int, error) {
	syncID, _ := s.db.InsertSyncHistory(ctx, 4, "paints", "running") // 4 = scunpacked

	paints, err := ReadPaints(s.dataPath)
	if err != nil {
		s.db.UpdateSyncHistory(ctx, syncID, "error", 0, err.Error())
		return 0, err
	}

	count := 0
	unmatched := 0

	for _, pp := range paints {
		// Resolve vehicle_id from the tag
		vehicleID := s.resolveVehicleID(ctx, pp.VehicleTag)

		// Generate slug from class_name: Paint_Carrack_BIS2950 → carrack-bis2950
		slug := slugFromClassName(pp.ClassName)

		paint := &models.Paint{
			Name:        pp.Name,
			Slug:        slug,
			ClassName:   pp.ClassName,
			VehicleID:   vehicleID,
			Description: pp.Description,
		}

		if _, err := s.db.UpsertPaint(ctx, paint); err != nil {
			log.Warn().Err(err).Str("class_name", pp.ClassName).Msg("failed to upsert paint")
			continue
		}

		if vehicleID == nil {
			unmatched++
		}
		count++
	}

	s.db.UpdateSyncHistory(ctx, syncID, "success", count, "")
	log.Info().
		Int("synced", count).
		Int("unmatched", unmatched).
		Int("total", len(paints)).
		Msg("scunpacked paint sync complete")

	return count, nil
}

// resolveVehicleID tries to match a paint tag (e.g. "Paint_Carrack") to a vehicle in the DB.
func (s *Syncer) resolveVehicleID(ctx context.Context, tag string) *int {
	// Normalize: strip Paint_ prefix, replace _ with -, lowercase
	normalized := tag
	normalized = strings.TrimPrefix(normalized, "Paint_")
	normalized = strings.TrimSuffix(normalized, "_Paint")
	normalized = strings.ReplaceAll(normalized, "_", "-")
	normalized = strings.ToLower(normalized)

	if normalized == "" {
		return nil
	}

	// Try exact slug match
	id, err := s.db.GetVehicleIDBySlug(ctx, normalized)
	if err == nil {
		return &id
	}

	// Try LIKE prefix match
	query := normalized + "%"
	id, err = s.findVehicleBySlugPrefix(ctx, query)
	if err == nil {
		return &id
	}

	// Try name contains match
	id, err = s.findVehicleByNameContains(ctx, normalized)
	if err == nil {
		return &id
	}

	log.Debug().Str("tag", tag).Str("normalized", normalized).Msg("no vehicle match for paint tag")
	return nil
}

func (s *Syncer) findVehicleBySlugPrefix(ctx context.Context, pattern string) (int, error) {
	query := "SELECT id FROM vehicles WHERE slug LIKE ? LIMIT 1"
	if s.db.Driver() == "postgres" {
		query = "SELECT id FROM vehicles WHERE slug LIKE $1 LIMIT 1"
	}
	var id int
	err := s.db.RawConn().QueryRowContext(ctx, query, pattern).Scan(&id)
	return id, err
}

func (s *Syncer) findVehicleByNameContains(ctx context.Context, term string) (int, error) {
	query := "SELECT id FROM vehicles WHERE LOWER(name) LIKE ? LIMIT 1"
	if s.db.Driver() == "postgres" {
		query = "SELECT id FROM vehicles WHERE LOWER(name) LIKE $1 LIMIT 1"
	}
	pattern := "%" + term + "%"
	var id int
	err := s.db.RawConn().QueryRowContext(ctx, query, pattern).Scan(&id)
	return id, err
}

// slugFromClassName converts a paint class_name to a URL-friendly slug.
// e.g. "Paint_Carrack_BIS2950" → "carrack-bis2950"
func slugFromClassName(className string) string {
	// Strip Paint_ prefix
	s := strings.TrimPrefix(className, "Paint_")

	// Replace _ with -
	s = strings.ReplaceAll(s, "_", "-")

	// Lowercase
	s = strings.ToLower(s)

	return s
}
