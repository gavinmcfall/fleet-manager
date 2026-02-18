package rsi

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/nzvengeance/fleet-manager/internal/database"
	"github.com/rs/zerolog/log"
)

// --- JSON extract types ---

// shipsExtract is the structure of the ships extract JSON file.
type shipsExtract struct {
	ShipMatrixImages  []shipEntry `json:"ship_matrix_images"`
	PledgeStoreImages []shipEntry `json:"pledge_store_images"`
}

type shipEntry struct {
	ImageURL string `json:"image_url"`
	ShipName string `json:"ship_name"`
}

// paintsExtract is the structure of the paints extract JSON file.
type paintsExtract struct {
	Items []paintEntry `json:"items"`
}

type paintEntry struct {
	ImageURL       string `json:"image_url"`
	ItemName       string `json:"item_name"`
	AssociatedShip string `json:"associated_ship"`
}

// imageSet holds the 4 image size URLs for a vehicle or paint.
type imageSet struct {
	imageURL string
	small    string
	medium   string
	large    string
}

// paintInfo holds match data for a DB paint entry.
type paintInfo struct {
	norm      string
	className string
	hasImage  bool
}

// mediaIDRegex extracts the media ID from old-format RSI CDN URLs.
// e.g. "https://media.robertsspaceindustries.com/e1i4i2ixe6ouo/store_small.jpg" → "e1i4i2ixe6ouo"
var mediaIDRegex = regexp.MustCompile(`media\.robertsspaceindustries\.com/([^/]+)/`)

// shipNameMap maps RSI ship_matrix names (lowercased) to the DB vehicle name (lowercased).
// Only entries that need fuzzy mapping — direct case-insensitive matches are handled automatically.
var shipNameMap = map[string]string{
	// Variant naming differences (RSI name → SC Wiki DB name)
	"600i explorer":                            "600i",
	"600i touring":                             "600i",
	"a2 hercules":                              "a2 hercules starlifter",
	"c2 hercules":                              "c2 hercules starlifter",
	"m2 hercules":                              "m2 hercules starlifter",
	"ares inferno":                             "ares star fighter inferno",
	"ares ion":                                 "ares star fighter ion",
	"mercury":                                  "mercury star runner",
	"m50":                                      "m50 interceptor",
	"85x":                                      "85x limited",
	"scythe":                                   "vanduul scythe",
	"stinger":                                  "esperia stinger",
	"merchantman":                              "banu merchantman",
	"dragonfly black":                          "dragonfly",
	"c8r pisces":                               "c8r pisces rescue",

	// Manufacturer prefix in RSI but not DB
	"anvil ballista dunestalker":               "ballista dunestalker",
	"anvil ballista snowblind":                 "ballista snowblind",
	"argo mole carbon edition":                 "mole carbon",
	"argo mole talus edition":                  "mole talus",

	// BIS edition year ordering
	"caterpillar best in show edition 2949":    "caterpillar 2949 best in show edition",
	"cutlass black best in show edition 2949":  "cutlass black 2949 best in show edition",
	"hammerhead best in show edition 2949":     "hammerhead 2949 best in show edition",
	"reclaimer best in show edition 2949":      "reclaimer 2949 best in show edition",

	// Pirate/special edition naming
	"gladius pirate edition":                   "gladius pirate",
	"caterpillar pirate edition":               "caterpillar pirate",

	// "Super" in RSI but not in SC Wiki DB
	"f7c-m super hornet heartseeker mk i":      "f7c-m hornet heartseeker mk i",
	"f7c-m super hornet mk i":                  "f7c-m super hornet mk i",
	"f7c-m super hornet mk ii":                 "f7c-m super hornet mk ii",

	// Other naming quirks
	"f8c lightning executive edition":          "f8c lightning executive edition",
	"constellation phoenix emerald":           "constellation phoenix emerald",
	"san'tok.yāi":                             "san\u2019tok.y\u0101i",
	"carrack expedition w/c8x":                "carrack expedition w/c8x",
	"carrack w/c8x":                           "carrack w/c8x",
}

// ImportImages reads RSI extract JSON files and imports ship + paint images into the database.
func ImportImages(ctx context.Context, db *database.DB, extractPath string) error {
	shipsFile := filepath.Join(extractPath, "ships.json")
	paintsFile := filepath.Join(extractPath, "paints.json")

	shipCount, paintCount := 0, 0

	if _, err := os.Stat(shipsFile); err == nil {
		count, err := importShipImages(ctx, db, shipsFile)
		if err != nil {
			log.Error().Err(err).Msg("RSI ship image import failed")
		} else {
			shipCount = count
		}
	} else {
		log.Info().Str("path", shipsFile).Msg("RSI ships extract file not found, skipping")
	}

	if _, err := os.Stat(paintsFile); err == nil {
		count, err := importPaintImages(ctx, db, paintsFile)
		if err != nil {
			log.Error().Err(err).Msg("RSI paint image import failed")
		} else {
			paintCount = count
		}
	} else {
		log.Info().Str("path", paintsFile).Msg("RSI paints extract file not found, skipping")
	}

	log.Info().
		Int("ships_updated", shipCount).
		Int("paints_updated", paintCount).
		Msg("RSI extract image import complete")

	return nil
}

// importShipImages processes the ships extract file and updates vehicle images.
func importShipImages(ctx context.Context, db *database.DB, filePath string) (int, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return 0, fmt.Errorf("reading ships extract: %w", err)
	}

	var extract shipsExtract
	if err := json.Unmarshal(data, &extract); err != nil {
		return 0, fmt.Errorf("parsing ships extract: %w", err)
	}

	vehicles, err := db.GetAllVehicleNameSlugs(ctx)
	if err != nil {
		return 0, fmt.Errorf("loading vehicles: %w", err)
	}

	// Build name → slug lookup (lowercased name → slug)
	nameToSlug := make(map[string]string, len(vehicles))
	for _, v := range vehicles {
		nameToSlug[strings.ToLower(v.Name)] = v.Slug
	}

	// slug → images for direct matches
	slugImages := make(map[string]imageSet)
	// RSI name (lowercased) → images for variant inheritance
	rsiNameImages := make(map[string]imageSet)

	matched, skipped, inherited := 0, 0, 0

	for _, entry := range extract.ShipMatrixImages {
		if entry.ImageURL == "" || entry.ShipName == "" {
			continue
		}

		images := buildImageURLs(entry.ImageURL)
		rsiNameImages[strings.ToLower(entry.ShipName)] = images

		slug := findVehicleSlug(entry.ShipName, nameToSlug)
		if slug == "" {
			skipped++
			log.Debug().Str("rsi_name", entry.ShipName).Msg("RSI ship: no DB match")
			continue
		}

		slugImages[slug] = images
	}

	// Update all directly matched vehicles
	for slug, img := range slugImages {
		if err := db.UpdateVehicleImages(ctx, slug, img.imageURL, img.small, img.medium, img.large); err != nil {
			log.Warn().Err(err).Str("slug", slug).Msg("failed to update vehicle images from RSI")
			continue
		}
		matched++
	}

	// Variant inheritance: for unmatched DB vehicles, try to find a base vehicle image
	for _, v := range vehicles {
		if _, already := slugImages[v.Slug]; already {
			continue
		}

		baseImg := findBaseVehicleImages(v.Name, rsiNameImages)
		if baseImg != nil {
			if err := db.UpdateVehicleImages(ctx, v.Slug, baseImg.imageURL, baseImg.small, baseImg.medium, baseImg.large); err != nil {
				log.Warn().Err(err).Str("slug", v.Slug).Msg("failed to update variant vehicle images")
				continue
			}
			inherited++
		}
	}

	log.Info().
		Int("matched", matched).
		Int("inherited", inherited).
		Int("skipped", skipped).
		Int("ship_matrix_total", len(extract.ShipMatrixImages)).
		Msg("RSI ship image import summary")

	return matched + inherited, nil
}

// buildImageURLs extracts the media ID and builds all 4 size URLs.
// For old media CDN URLs (media.robertsspaceindustries.com/{id}/store_small.jpg),
// it generates store_small, store_large, store_hub_large, and source variants.
// For new CDN URLs (/i/{hash}/resize(...) or /media/), it uses the URL as-is.
func buildImageURLs(url string) imageSet {
	matches := mediaIDRegex.FindStringSubmatch(url)
	if len(matches) >= 2 {
		mediaID := matches[1]
		base := "https://media.robertsspaceindustries.com/" + mediaID
		return imageSet{
			imageURL: base + "/store_large.jpg",
			small:    base + "/store_small.jpg",
			medium:   base + "/store_large.jpg",
			large:    base + "/store_hub_large.jpg",
		}
	}

	// New CDN format or /media/ format — use as-is for all sizes
	return imageSet{
		imageURL: url,
		small:    url,
		medium:   url,
		large:    url,
	}
}

// findVehicleSlug matches an RSI ship name to a DB vehicle slug.
func findVehicleSlug(rsiName string, nameToSlug map[string]string) string {
	lower := strings.ToLower(rsiName)

	// 1. Direct name match
	if slug, ok := nameToSlug[lower]; ok {
		return slug
	}

	// 2. Check fuzzy name map
	if mapped, ok := shipNameMap[lower]; ok {
		if slug, ok := nameToSlug[mapped]; ok {
			return slug
		}
	}

	// 3. Try removing manufacturer prefix (e.g., "Argo Mole Carbon Edition" → "Mole Carbon Edition")
	if idx := strings.Index(lower, " "); idx > 0 {
		withoutPrefix := lower[idx+1:]
		if slug, ok := nameToSlug[withoutPrefix]; ok {
			return slug
		}
	}

	return ""
}

// findBaseVehicleImages tries to find a base vehicle's images for a variant.
// e.g., "Corsair PYAM Exec Edition" → looks for "corsair" in rsiNameImages.
func findBaseVehicleImages(vehicleName string, rsiNameImages map[string]imageSet) *imageSet {
	lower := strings.ToLower(vehicleName)

	// Try progressively shorter prefixes of the vehicle name
	words := strings.Fields(lower)
	for length := len(words) - 1; length >= 1; length-- {
		prefix := strings.Join(words[:length], " ")
		if img, ok := rsiNameImages[prefix]; ok {
			return &img
		}
	}

	return nil
}

// importPaintImages processes the paints extract file and updates paint images.
func importPaintImages(ctx context.Context, db *database.DB, filePath string) (int, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return 0, fmt.Errorf("reading paints extract: %w", err)
	}

	var extract paintsExtract
	if err := json.Unmarshal(data, &extract); err != nil {
		return 0, fmt.Errorf("parsing paints extract: %w", err)
	}

	paints, err := db.GetAllPaintNameClasses(ctx)
	if err != nil {
		return 0, fmt.Errorf("loading paints: %w", err)
	}

	// Build normalized name → info lookup (exact match)
	// and a list for substring matching
	exactLookup := make(map[string]*paintInfo, len(paints))
	allPaints := make([]*paintInfo, 0, len(paints))
	for _, p := range paints {
		info := &paintInfo{
			norm:      normalizePaintName(p.Name),
			className: p.ClassName,
			hasImage:  p.HasImage,
		}
		exactLookup[info.norm] = info
		allPaints = append(allPaints, info)
	}

	seen := make(map[string]bool)
	matched, skippedHasImage, skippedNoMatch := 0, 0, 0

	for _, entry := range extract.Items {
		if entry.ImageURL == "" || entry.ItemName == "" {
			continue
		}

		// RSI format: "Arrow - Lovestruck Paint" → DB format: "Arrow Lovestruck Livery"
		// Combine ship + paint into a single name for matching against DB paint names
		fullName := buildPaintFullName(entry.ItemName)
		if fullName == "" {
			continue
		}

		norm := normalizePaintName(fullName)
		if seen[norm] {
			continue
		}
		seen[norm] = true

		// Try exact match, then substring match
		info := findPaintMatch(norm, exactLookup, allPaints)
		if info == nil {
			skippedNoMatch++
			log.Debug().Str("item_name", entry.ItemName).Str("normalized", norm).Msg("RSI paint: no DB match")
			continue
		}

		if info.hasImage {
			skippedHasImage++
			continue
		}

		// RSI new CDN format — store full URL (signed resize params, no size variants)
		if err := db.UpdatePaintImages(ctx, info.className, entry.ImageURL, entry.ImageURL, entry.ImageURL, entry.ImageURL); err != nil {
			log.Warn().Err(err).Str("class_name", info.className).Msg("failed to update paint images from RSI")
			continue
		}
		matched++
	}

	log.Info().
		Int("matched", matched).
		Int("skipped_has_image", skippedHasImage).
		Int("skipped_no_match", skippedNoMatch).
		Int("total", len(extract.Items)).
		Msg("RSI paint image import summary")

	return matched, nil
}

// findPaintMatch finds a DB paint matching the RSI normalized name.
// Tries exact match, then prefix match, then year-stripped match.
func findPaintMatch(norm string, exact map[string]*paintInfo, all []*paintInfo) *paintInfo {
	// 1. Exact match
	if info, ok := exact[norm]; ok {
		return info
	}

	// 2. Prefix: RSI name is prefix of DB name (e.g., "eclipse ambush" in "eclipse ambush camo")
	for _, info := range all {
		if strings.HasPrefix(info.norm, norm) {
			return info
		}
	}

	// 3. Year-stripped match: DB names include years (e.g., "400i 2954 auspicious red dog")
	// that the RSI API omits (e.g., "400i auspicious red dog")
	normNoYear := stripYears(norm)
	for _, info := range all {
		if stripYears(info.norm) == normNoYear {
			return info
		}
	}

	return nil
}

// stripYears removes 4-digit year numbers from a paint name and collapses spaces.
func stripYears(s string) string {
	result := yearRegex.ReplaceAllString(s, "")
	return strings.Join(strings.Fields(result), " ")
}

// buildPaintFullName converts an RSI item_name to the DB paint name format.
// RSI format: "Arrow - Lovestruck Paint" → DB format: "Arrow Lovestruck Paint"
// The " - " separator is replaced with a space so the full name matches DB conventions.
func buildPaintFullName(itemName string) string {
	parts := strings.SplitN(itemName, " - ", 2)
	if len(parts) != 2 {
		return ""
	}
	ship := strings.TrimSpace(parts[0])
	paint := strings.TrimSpace(parts[1])
	return ship + " " + paint
}

// yearRegex matches 4-digit years (e.g., "2949", "2954") in paint names.
var yearRegex = regexp.MustCompile(`\b\d{4}\b`)

// paintNameFixes maps common RSI misspellings to DB spellings.
var paintNameFixes = strings.NewReplacer(
	"bushwacker", "bushwhacker",
)

// normalizePaintName strips common suffixes, lowercases, and normalizes unicode for comparison.
func normalizePaintName(name string) string {
	n := strings.ToLower(strings.TrimSpace(name))
	n = strings.TrimSuffix(n, " paint")
	n = strings.TrimSuffix(n, " livery")
	n = strings.TrimSuffix(n, " skin")
	// Normalize unicode diacritics (RSI uses ā/ē but DB uses plain ASCII)
	// and curly apostrophes (RSI uses ' U+2019 but DB uses ' U+0027)
	n = strings.NewReplacer(
		"\u0101", "a", // ā → a
		"\u0113", "e", // ē → e
		"\u012b", "i", // ī → i
		"\u014d", "o", // ō → o
		"\u016b", "u", // ū → u
		"\u2019", "'", // ' (right single quote) → '
		"\u2018", "'", // ' (left single quote) → '
		"\u02bc", "'", // ʼ (modifier letter apostrophe) → '
	).Replace(n)
	// Fix known misspellings
	n = paintNameFixes.Replace(n)
	return n
}
