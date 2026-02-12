package analysis

import (
	"strings"

	"github.com/nzvengeance/fleet-manager/internal/models"
)

// RoleMapping maps ship focus strings to role categories
var roleMapping = map[string]string{
	"Fighter":           "Combat",
	"Heavy Fighter":     "Combat",
	"Light Fighter":     "Combat",
	"Stealth Fighter":   "Combat",
	"Interdiction":      "Combat",
	"Bomber":            "Combat",
	"Gunship":           "Combat",
	"Corvette":          "Combat",
	"Frigate":           "Combat",
	"Destroyer":         "Combat",
	"Carrier":           "Combat",
	"Combat":            "Combat",
	"Dropship":          "Combat",
	"Mining":            "Industrial",
	"Salvage":           "Industrial",
	"Refinery":          "Industrial",
	"Construction":      "Industrial",
	"Repair":            "Industrial",
	"Freight":           "Transport",
	"Cargo":             "Transport",
	"Transport":         "Transport",
	"Refueling":         "Transport",
	"Medical":           "Medical",
	"Exploration":       "Exploration",
	"Pathfinder":        "Exploration",
	"Expedition":        "Exploration",
	"Science":           "Exploration",
	"Data":              "Exploration",
	"Racing":            "Racing",
	"Competition":       "Racing",
	"Touring":           "Civilian",
	"Luxury":            "Civilian",
	"Passenger":         "Civilian",
	"Starter":           "Civilian",
	"Multi-Role":        "Multi-Role",
	"Modular":           "Multi-Role",
	"Ground":            "Ground Vehicle",
	"Reporting":         "Support",
	"EW":                "Support",
	"Support":           "Support",
	"Snub Fighter":      "Snub",
}

// AnalyzeFleet performs comprehensive fleet analysis
func AnalyzeFleet(vehicles []models.Vehicle, allShips []models.Ship) *models.FleetAnalysis {
	analysis := &models.FleetAnalysis{
		SizeDistribution: make(map[string]int),
		RoleCategories:   make(map[string][]string),
	}

	// Build analysis
	analysis.Overview = buildOverview(vehicles)
	analysis.SizeDistribution = buildSizeDistribution(vehicles)
	analysis.RoleCategories = buildRoleCategories(vehicles)
	analysis.GapAnalysis = buildGapAnalysis(vehicles, allShips)
	analysis.Redundancies = buildRedundancies(vehicles)
	analysis.InsuranceSummary = buildInsuranceSummary(vehicles)

	return analysis
}

func buildOverview(vehicles []models.Vehicle) models.FleetOverview {
	overview := models.FleetOverview{
		TotalVehicles: len(vehicles),
	}

	for _, v := range vehicles {
		if v.Ship != nil {
			overview.TotalCargo += v.Ship.Cargo
			overview.TotalPledgeValue += v.Ship.PledgePrice
			overview.MinCrew += v.Ship.MinCrew
			overview.MaxCrew += v.Ship.MaxCrew

			if v.Ship.ProductionStatus == "flight-ready" {
				overview.FlightReady++
			} else {
				overview.InConcept++
			}
		}

		if v.HangarImport != nil {
			if v.HangarImport.LTI {
				overview.LTICount++
			} else {
				overview.NonLTICount++
			}
		}
	}

	return overview
}

func buildSizeDistribution(vehicles []models.Vehicle) map[string]int {
	dist := make(map[string]int)
	for _, v := range vehicles {
		size := "Unknown"
		if v.Ship != nil && v.Ship.SizeLabel != "" {
			size = v.Ship.SizeLabel
		}
		dist[size]++
	}
	return dist
}

func buildRoleCategories(vehicles []models.Vehicle) map[string][]string {
	categories := make(map[string][]string)
	for _, v := range vehicles {
		focus := ""
		if v.Ship != nil {
			focus = v.Ship.Focus
		}

		category := "Uncategorised"
		for key, cat := range roleMapping {
			if strings.EqualFold(focus, key) || strings.Contains(strings.ToLower(focus), strings.ToLower(key)) {
				category = cat
				break
			}
		}

		displayName := v.ShipName
		if v.CustomName != "" {
			displayName = v.ShipName + " \"" + v.CustomName + "\""
		}
		categories[category] = append(categories[category], displayName)
	}
	return categories
}

func buildGapAnalysis(vehicles []models.Vehicle, allShips []models.Ship) []GapItem {
	// Collect roles the user has
	ownedRoles := make(map[string]bool)
	for _, v := range vehicles {
		if v.Ship != nil && v.Ship.Focus != "" {
			ownedRoles[strings.ToLower(v.Ship.Focus)] = true
		}
	}

	// Collect all possible roles from the ship database
	allRoles := make(map[string]int)
	for _, s := range allShips {
		if s.Focus != "" {
			allRoles[strings.ToLower(s.Focus)]++
		}
	}

	var gaps []models.GapItem

	// Define important gameplay roles and check for gaps
	criticalRoles := []struct {
		role        string
		matchTerms  []string
		priority    string
		description string
		suggestions []string
	}{
		{
			role:        "Dedicated Mining",
			matchTerms:  []string{"mining"},
			priority:    "high",
			description: "No flight-ready dedicated mining ship. Mining is one of the most profitable gameplay loops.",
			suggestions: []string{"MOLE (multi-crew, $315)", "Prospector (solo, $155)"},
		},
		{
			role:        "Refueling",
			matchTerms:  []string{"refueling"},
			priority:    "high",
			description: "No refueling capability. Critical for extended operations and fleet support.",
			suggestions: []string{"Starfarer/Starfarer Gemini", "Vulcan (repair/refuel/rearm)"},
		},
		{
			role:        "Repair",
			matchTerms:  []string{"repair"},
			priority:    "medium",
			description: "No dedicated repair ship for field maintenance.",
			suggestions: []string{"Vulcan (multi-role support)", "Crucible (dedicated repair)"},
		},
		{
			role:        "Data Running",
			matchTerms:  []string{"data"},
			priority:    "low",
			description: "No data running capability for information-based gameplay.",
			suggestions: []string{"Mercury Star Runner", "Herald"},
		},
		{
			role:        "Stealth / EW",
			matchTerms:  []string{"stealth", "ew", "electronic warfare"},
			priority:    "medium",
			description: "Limited stealth and electronic warfare capabilities.",
			suggestions: []string{"Eclipse (stealth bomber)", "Sabre (stealth fighter)", "Vanguard Sentinel (EW)"},
		},
		{
			role:        "Dedicated Bomber",
			matchTerms:  []string{"bomber"},
			priority:    "low",
			description: "No dedicated torpedo/bomb delivery platform.",
			suggestions: []string{"Eclipse", "Retaliator Bomber", "A2 Hercules"},
		},
		{
			role:        "Passenger Transport",
			matchTerms:  []string{"passenger", "touring"},
			priority:    "low",
			description: "No passenger transport capability.",
			suggestions: []string{"E1 Spirit", "Genesis Starliner"},
		},
	}

	for _, cr := range criticalRoles {
		hasRole := false
		for _, term := range cr.matchTerms {
			// Check if any owned role contains this term (not exact match)
			for ownedRole := range ownedRoles {
				if strings.Contains(ownedRole, term) {
					hasRole = true
					break
				}
			}
			if hasRole {
				break
			}
		}
		if !hasRole {
			gaps = append(gaps, models.GapItem{
				Role:        cr.role,
				Priority:    cr.priority,
				Description: cr.description,
				Suggestions: cr.suggestions,
			})
		}
	}

	return gaps
}

type GapItem = models.GapItem

func buildRedundancies(vehicles []models.Vehicle) []models.RedundancyGroup {
	// Group vehicles by focus/role
	roleShips := make(map[string][]string)
	for _, v := range vehicles {
		focus := "Unknown"
		if v.Ship != nil && v.Ship.Focus != "" {
			focus = v.Ship.Focus
		}
		displayName := v.ShipName
		if v.CustomName != "" {
			displayName = v.ShipName + " \"" + v.CustomName + "\""
		}
		roleShips[focus] = append(roleShips[focus], displayName)
	}

	var redundancies []models.RedundancyGroup
	for role, ships := range roleShips {
		if len(ships) > 1 {
			redundancies = append(redundancies, models.RedundancyGroup{
				Role:  role,
				Ships: ships,
				Notes: "",
			})
		}
	}

	return redundancies
}

func buildInsuranceSummary(vehicles []models.Vehicle) models.InsuranceSummary {
	summary := models.InsuranceSummary{}

	for _, v := range vehicles {
		entry := models.InsuranceEntry{
			ShipName:   v.ShipName,
			CustomName: v.CustomName,
		}

		if v.HangarImport != nil {
			entry.LTI = v.HangarImport.LTI
			entry.Warbond = v.HangarImport.Warbond
			entry.PledgeCost = v.HangarImport.PledgeCost
			entry.PledgeName = v.HangarImport.PledgeName
			entry.PledgeDate = v.HangarImport.PledgeDate

			if v.HangarImport.LTI {
				summary.LTIShips = append(summary.LTIShips, entry)
			} else {
				summary.NonLTIShips = append(summary.NonLTIShips, entry)
			}
		} else {
			summary.UnknownShips = append(summary.UnknownShips, entry)
		}
	}

	return summary
}
