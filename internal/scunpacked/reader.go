package scunpacked

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog/log"
)

// paintFile represents the JSON structure of a scunpacked-data paint file.
type paintFile struct {
	Item paintItem `json:"Item"`
}

type paintItem struct {
	ClassName    string       `json:"className"`
	Name         string       `json:"name"`
	RequiredTags string       `json:"required_tags"`
	StdItem      *paintStdItem `json:"stdItem"`
}

type paintStdItem struct {
	Name         string       `json:"Name"`
	Description  string       `json:"Description"`
	ClassName    string       `json:"ClassName"`
	RequiredTags []string     `json:"RequiredTags"`
}

// ParsedPaint is a clean representation of a paint parsed from scunpacked-data.
type ParsedPaint struct {
	ClassName   string
	Name        string
	Description string
	VehicleTag  string // e.g. "Paint_Carrack" → used for vehicle matching
}

// ReadPaints reads all paint_*.json files from the scunpacked-data items directory
// and returns parsed paints, filtering out placeholders and non-ship paints.
func ReadPaints(dataPath string) ([]ParsedPaint, error) {
	pattern := filepath.Join(dataPath, "items", "paint_*.json")
	files, err := filepath.Glob(pattern)
	if err != nil {
		return nil, fmt.Errorf("globbing paint files: %w", err)
	}

	if len(files) == 0 {
		return nil, fmt.Errorf("no paint files found at %s", pattern)
	}

	log.Info().Int("files", len(files)).Str("path", pattern).Msg("reading scunpacked paint files")

	var paints []ParsedPaint
	skipped := 0

	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			log.Warn().Err(err).Str("file", f).Msg("failed to read paint file")
			continue
		}

		var pf paintFile
		if err := json.Unmarshal(data, &pf); err != nil {
			log.Warn().Err(err).Str("file", f).Msg("failed to parse paint file")
			continue
		}

		item := pf.Item

		// Use stdItem fields if available, fall back to top-level
		name := item.Name
		description := ""
		className := item.ClassName

		if item.StdItem != nil {
			if item.StdItem.Name != "" {
				name = item.StdItem.Name
			}
			description = item.StdItem.Description
			if item.StdItem.ClassName != "" {
				className = item.StdItem.ClassName
			}
		}

		// Filter out placeholders
		if strings.Contains(name, "PLACEHOLDER") {
			skipped++
			continue
		}

		// Generate a readable name from className if name is empty
		if name == "" {
			name = nameFromClassName(className)
		}

		// Filter out paints without a vehicle tag
		// RequiredTags can be space-separated (e.g. "Paint_Hornet_F7_Mk2 ANVL_Hornet_F7A_Mk2")
		// — take only the first paint-related tag for vehicle matching.
		vehicleTag := item.RequiredTags
		if vehicleTag == "" && item.StdItem != nil && len(item.StdItem.RequiredTags) > 0 {
			vehicleTag = item.StdItem.RequiredTags[0]
		}
		if strings.Contains(vehicleTag, " ") {
			vehicleTag = strings.Fields(vehicleTag)[0]
		}
		if vehicleTag == "" || !isPaintTag(vehicleTag) {
			skipped++
			continue
		}

		paints = append(paints, ParsedPaint{
			ClassName:   className,
			Name:        name,
			Description: description,
			VehicleTag:  vehicleTag,
		})
	}

	log.Info().
		Int("valid", len(paints)).
		Int("skipped", skipped).
		Int("total_files", len(files)).
		Msg("finished reading scunpacked paint files")

	return paints, nil
}

// isPaintTag returns true if the tag is a paint vehicle tag in any known format:
// "Paint_Carrack", "Caterpillar_Paint", "paint_golem"
func isPaintTag(tag string) bool {
	lower := strings.ToLower(tag)
	return strings.HasPrefix(lower, "paint_") || strings.HasSuffix(lower, "_paint")
}

// nameFromClassName generates a readable name from a paint className.
// e.g. "Paint_Cutlass_Black_Procyon" → "Cutlass Black Procyon"
func nameFromClassName(className string) string {
	s := strings.TrimPrefix(className, "Paint_")
	s = strings.ReplaceAll(s, "_", " ")
	return s
}
