package scunpacked

import (
	"context"
	"strings"

	"github.com/nzvengeance/fleet-manager/internal/database"
	"github.com/nzvengeance/fleet-manager/internal/models"
	"github.com/rs/zerolog/log"
)

// tagAliases maps normalized paint tags to vehicle slugs or LIKE patterns.
// Needed when the tag abbreviation doesn't match any vehicle slug directly.
// Values containing '%' are used as LIKE patterns; others are used as exact slugs.
var tagAliases = map[string]string{
	"890j":           "890-jump",
	"star-runner":    "mercury-star-runner",
	"starfighter":    "ares-star-fighter",
	"hornet-f7-mk2":  "%hornet%mk-ii",
	"hornet-f7c-mk2": "%hornet%mk-ii",
	"hornet":         "%hornet%",
	"herald":         "herald",
	"msr":            "mercury-star-runner",
}

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
		// Resolve vehicle IDs from the tag (may return multiple)
		vehicleIDs := s.resolveVehicleIDs(ctx, pp.VehicleTag)

		// Generate slug from class_name: Paint_Carrack_BIS2950 → carrack-bis2950
		slug := slugFromClassName(pp.ClassName)

		paint := &models.Paint{
			Name:        pp.Name,
			Slug:        slug,
			ClassName:   pp.ClassName,
			Description: pp.Description,
		}

		paintID, err := s.db.UpsertPaint(ctx, paint)
		if err != nil {
			log.Warn().Err(err).Str("class_name", pp.ClassName).Msg("failed to upsert paint")
			continue
		}

		if len(vehicleIDs) > 0 {
			if err := s.db.SetPaintVehicles(ctx, paintID, vehicleIDs); err != nil {
				log.Warn().Err(err).Str("class_name", pp.ClassName).Msg("failed to set paint vehicles")
			}
		} else {
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

// resolveVehicleIDs tries to match a paint tag (e.g. "Paint_Carrack") to vehicles in the DB.
// Returns all matching vehicle IDs (empty slice if no match).
func (s *Syncer) resolveVehicleIDs(ctx context.Context, tag string) []int {
	// Normalize: strip Paint_ prefix / _Paint suffix, replace _ with -, lowercase
	normalized := tag
	normalized = strings.TrimPrefix(normalized, "Paint_")
	normalized = strings.TrimSuffix(normalized, "_Paint")
	normalized = strings.ReplaceAll(normalized, "_", "-")
	normalized = strings.ToLower(normalized)

	if normalized == "" {
		return nil
	}

	// Check alias map
	if alias, ok := tagAliases[normalized]; ok {
		if strings.Contains(alias, "%") {
			// LIKE pattern
			ids, err := s.db.FindVehicleIDsBySlugLike(ctx, alias)
			if err == nil && len(ids) > 0 {
				return ids
			}
		} else {
			// Use alias as the new normalized term
			normalized = alias
		}
	}

	// Try exact slug match
	id, err := s.db.GetVehicleIDBySlug(ctx, normalized)
	if err == nil {
		return []int{id}
	}

	// Try prefix match (all vehicles whose slug starts with normalized)
	ids, err := s.db.FindVehicleIDsBySlugPrefix(ctx, normalized)
	if err == nil && len(ids) > 0 {
		return ids
	}

	// Try name-contains match (replace hyphens with spaces for name search)
	nameTerm := strings.ReplaceAll(normalized, "-", " ")
	ids, err = s.db.FindVehicleIDsByNameContains(ctx, nameTerm)
	if err == nil && len(ids) > 0 {
		return ids
	}

	log.Debug().Str("tag", tag).Str("normalized", normalized).Msg("no vehicle match for paint tag")
	return nil
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
