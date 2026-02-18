package rsi

import (
	"context"
	"fmt"
	"strings"

	"github.com/nzvengeance/fleet-manager/internal/database"
	"github.com/rs/zerolog/log"
)

const (
	syncSourceID = 5   // rsi_api in sync_sources
	pageLimit    = 100 // RSI GraphQL max page size
)

// paintShipAliases maps RSI store ship names (lowercased) to DB paint name prefixes.
// RSI uses abbreviated ship names in paint listings (e.g., "Ares" instead of "Ares Star Fighter").
var paintShipAliases = map[string]string{
	"ares":              "Ares Star Fighter",
	"hercules":          "Hercules Starlifter",
	"mercury":           "Mercury Star Runner",
	"f8c":               "F8C Lightning",
	"f7 hornet mk i":    "Hornet",
	"f7 hornet mk ii":   "Hornet Mk II",
	"f7a hornet mk ii":  "Hornet",
	"nova tank":         "Nova",
	"san\u0027tok.y\u0101i": "San'tok.yai",
}

// browseQuery is the GraphQL query used for both ships and paints.
// RSI's store browse endpoint returns paginated results with CDN image URLs.
// Notes:
// - SearchQuery type must NOT have ! (nullable) — RSI's schema rejects non-null
// - isPackage lives on TySku, so requires inline fragment spread
// - __typename fields are required by RSI's GraphQL server
const browseQuery = `query GetBrowseItems($query: SearchQuery) {
	store(browse: true) {
		listing: search(query: $query) {
			resources {
				id
				name
				title
				url
				media {
					thumbnail {
						storeSmall
						__typename
					}
					__typename
				}
				nativePrice {
					amount
					__typename
				}
				... on TySku {
					isPackage
					__typename
				}
				__typename
			}
			count
			totalCount
			__typename
		}
		__typename
	}
}`

// Syncer orchestrates RSI API ship + paint image sync.
type Syncer struct {
	client *Client
	db     *database.DB
}

// NewSyncer creates a new RSI API syncer.
func NewSyncer(client *Client, db *database.DB) *Syncer {
	return &Syncer{
		client: client,
		db:     db,
	}
}

// SyncAll runs ship image sync, then paint image sync.
// Both queries work without authentication via the public GraphQL API.
func (s *Syncer) SyncAll(ctx context.Context) error {
	if err := s.SyncShipImages(ctx); err != nil {
		log.Error().Err(err).Msg("RSI API ship image sync failed")
	}

	if err := s.SyncPaintImages(ctx); err != nil {
		log.Error().Err(err).Msg("RSI API paint image sync failed")
	}

	return nil
}

// SyncShipImages fetches all ships from the RSI GraphQL API and updates vehicle images.
func (s *Syncer) SyncShipImages(ctx context.Context) error {
	syncID, _ := s.db.InsertSyncHistory(ctx, syncSourceID, "ships", "running")

	log.Info().Msg("RSI API ship image sync starting")

	// Fetch all ships (paginated — API may return fewer than pageLimit per page)
	var allShips []browseResource
	for page := 1; ; page++ {
		variables := map[string]any{
			"query": map[string]any{
				"page":  page,
				"limit": pageLimit,
				"ships": map[string]any{"all": true},
				"sort":  map[string]any{"field": "name", "direction": "asc"},
			},
		}

		data, err := s.client.QueryGraphQL(ctx, browseQuery, variables)
		if err != nil {
			s.db.UpdateSyncHistory(ctx, syncID, "error", 0, err.Error())
			return fmt.Errorf("fetching ships page %d: %w", page, err)
		}

		resp, err := ParseBrowseResponse(data)
		if err != nil {
			s.db.UpdateSyncHistory(ctx, syncID, "error", 0, err.Error())
			return fmt.Errorf("parsing ships page %d: %w", page, err)
		}

		allShips = append(allShips, resp.Store.Listing.Resources...)
		log.Debug().Int("page", page).Int("count", resp.Store.Listing.Count).Int("total", resp.Store.Listing.TotalCount).Msg("RSI ships page fetched")

		if resp.Store.Listing.Count == 0 || len(allShips) >= resp.Store.Listing.TotalCount {
			break
		}
	}

	log.Info().Int("total_ships", len(allShips)).Msg("RSI API ships fetched")

	// Load DB vehicles for matching
	vehicles, err := s.db.GetAllVehicleNameSlugs(ctx)
	if err != nil {
		s.db.UpdateSyncHistory(ctx, syncID, "error", 0, err.Error())
		return fmt.Errorf("loading vehicles: %w", err)
	}

	nameToSlug := make(map[string]string, len(vehicles))
	for _, v := range vehicles {
		nameToSlug[strings.ToLower(v.Name)] = v.Slug
	}

	// slug → images for direct matches
	slugImages := make(map[string]imageSet)
	// RSI name (lowercased) → images for variant inheritance
	rsiNameImages := make(map[string]imageSet)

	matched, skipped := 0, 0

	for _, ship := range allShips {
		name := ship.Name
		if name == "" {
			name = ship.Title
		}
		if name == "" {
			continue
		}

		imageURL := ship.Media.Thumbnail.StoreSmall
		if imageURL == "" {
			continue
		}

		images := buildImageURLs(imageURL)
		rsiNameImages[strings.ToLower(name)] = images

		slug := findVehicleSlug(name, nameToSlug)
		if slug == "" {
			skipped++
			log.Debug().Str("rsi_name", name).Msg("RSI API ship: no DB match")
			continue
		}

		slugImages[slug] = images
	}

	// Update all directly matched vehicles
	for slug, img := range slugImages {
		if err := s.db.UpdateVehicleImages(ctx, slug, img.imageURL, img.small, img.medium, img.large); err != nil {
			log.Warn().Err(err).Str("slug", slug).Msg("failed to update vehicle images from RSI API")
			continue
		}
		matched++
	}

	// Variant inheritance: for unmatched DB vehicles, try to find a base vehicle image
	inherited := 0
	for _, v := range vehicles {
		if _, already := slugImages[v.Slug]; already {
			continue
		}

		baseImg := findBaseVehicleImages(v.Name, rsiNameImages)
		if baseImg != nil {
			if err := s.db.UpdateVehicleImages(ctx, v.Slug, baseImg.imageURL, baseImg.small, baseImg.medium, baseImg.large); err != nil {
				log.Warn().Err(err).Str("slug", v.Slug).Msg("failed to update variant vehicle images from RSI API")
				continue
			}
			inherited++
		}
	}

	total := matched + inherited
	s.db.UpdateSyncHistory(ctx, syncID, "success", total, "")

	log.Info().
		Int("matched", matched).
		Int("inherited", inherited).
		Int("skipped", skipped).
		Int("total_rsi_ships", len(allShips)).
		Msg("RSI API ship image sync complete")

	return nil
}

// SyncPaintImages fetches all paints from the RSI GraphQL API and updates paint images.
func (s *Syncer) SyncPaintImages(ctx context.Context) error {
	syncID, _ := s.db.InsertSyncHistory(ctx, syncSourceID, "paints", "running")

	log.Info().Msg("RSI API paint image sync starting")

	// Fetch all paints (paginated, ~464 paints = 5 pages)
	var allPaints []browseResource
	for page := 1; ; page++ {
		variables := map[string]any{
			"query": map[string]any{
				"page":  page,
				"limit": pageLimit,
				"skus": map[string]any{
					"filtersFromTags": map[string]any{
						"tagIdentifiers":  []string{"weight", "desc"},
						"facetIdentifiers": []string{"paints"},
					},
					"products": []int{268},
				},
				"sort": map[string]any{"field": "weight", "direction": "desc"},
			},
		}

		data, err := s.client.QueryGraphQL(ctx, browseQuery, variables)
		if err != nil {
			s.db.UpdateSyncHistory(ctx, syncID, "error", 0, err.Error())
			return fmt.Errorf("fetching paints page %d: %w", page, err)
		}

		resp, err := ParseBrowseResponse(data)
		if err != nil {
			s.db.UpdateSyncHistory(ctx, syncID, "error", 0, err.Error())
			return fmt.Errorf("parsing paints page %d: %w", page, err)
		}

		allPaints = append(allPaints, resp.Store.Listing.Resources...)
		log.Debug().Int("page", page).Int("count", resp.Store.Listing.Count).Int("total", resp.Store.Listing.TotalCount).Msg("RSI paints page fetched")

		if resp.Store.Listing.Count == 0 || len(allPaints) >= resp.Store.Listing.TotalCount {
			break
		}
	}

	log.Info().Int("total_paints", len(allPaints)).Msg("RSI API paints fetched")

	// Load DB paints for matching
	dbPaints, err := s.db.GetAllPaintNameClasses(ctx)
	if err != nil {
		s.db.UpdateSyncHistory(ctx, syncID, "error", 0, err.Error())
		return fmt.Errorf("loading paints: %w", err)
	}

	// Build normalized name → info lookup
	exactLookup := make(map[string]*paintInfo, len(dbPaints))
	allDBPaints := make([]*paintInfo, 0, len(dbPaints))
	for _, p := range dbPaints {
		info := &paintInfo{
			norm:      normalizePaintName(p.Name),
			className: p.ClassName,
			hasImage:  p.HasImage,
		}
		exactLookup[info.norm] = info
		allDBPaints = append(allDBPaints, info)
	}

	matched, skippedNoImage, skippedNoMatch, skippedPackage := 0, 0, 0, 0

	for _, paint := range allPaints {
		// Skip paint packs (bundles of multiple paints)
		if paint.IsPackage {
			skippedPackage++
			continue
		}

		imageURL := paint.Media.Thumbnail.StoreSmall
		if imageURL == "" {
			skippedNoImage++
			continue
		}

		// Paint names follow "Ship - Paint Name" format
		name := paint.Name
		if name == "" {
			name = paint.Title
		}
		if name == "" {
			continue
		}

		// Expand abbreviated ship names before matching
		// e.g., "Ares - Cinder Paint" → "Ares Star Fighter - Cinder Paint"
		name = expandRSIPaintName(name)

		// Convert "Ship - Paint Name" → "Ship Paint Name" for DB matching
		fullName := buildPaintFullName(name)
		if fullName == "" {
			fullName = name
		}

		norm := normalizePaintName(fullName)
		info := findPaintMatch(norm, exactLookup, allDBPaints)
		if info == nil {
			skippedNoMatch++
			log.Debug().Str("name", name).Str("normalized", norm).Msg("RSI API paint: no DB match")
			continue
		}

		// Build image set from the CDN URL (extract media ID for size variants)
		images := buildImageURLs(imageURL)
		if err := s.db.UpdatePaintImages(ctx, info.className, images.imageURL, images.small, images.medium, images.large); err != nil {
			log.Warn().Err(err).Str("class_name", info.className).Msg("failed to update paint images from RSI API")
			continue
		}
		matched++
	}

	s.db.UpdateSyncHistory(ctx, syncID, "success", matched, "")

	log.Info().
		Int("matched", matched).
		Int("skipped_no_image", skippedNoImage).
		Int("skipped_no_match", skippedNoMatch).
		Int("skipped_package", skippedPackage).
		Int("total_rsi_paints", len(allPaints)).
		Msg("RSI API paint image sync complete")

	return nil
}

// expandRSIPaintName expands abbreviated ship names in RSI "Ship - Paint" format.
// e.g., "Ares - Cinder Paint" → "Ares Star Fighter - Cinder Paint"
func expandRSIPaintName(name string) string {
	parts := strings.SplitN(name, " - ", 2)
	if len(parts) != 2 {
		return name
	}

	ship := strings.TrimSpace(parts[0])
	paint := strings.TrimSpace(parts[1])
	lower := strings.ToLower(ship)

	if expanded, ok := paintShipAliases[lower]; ok {
		return expanded + " - " + paint
	}

	return name
}
