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

// AnalyzeFleet performs comprehensive fleet analysis using user fleet entries
// (which have reference data JOINed in) and the full vehicle reference list.
func AnalyzeFleet(fleet []models.UserFleetEntry, allVehicles []models.Vehicle) *models.FleetAnalysis {
	analysis := &models.FleetAnalysis{
		SizeDistribution: make(map[string]int),
		RoleCategories:   make(map[string][]string),
	}

	analysis.Overview = buildOverview(fleet)
	analysis.SizeDistribution = buildSizeDistribution(fleet)
	analysis.RoleCategories = buildRoleCategories(fleet)
	analysis.GapAnalysis = buildGapAnalysis(fleet, allVehicles)
	analysis.Redundancies = buildRedundancies(fleet)
	analysis.InsuranceSummary = buildInsuranceSummary(fleet)

	return analysis
}

func buildOverview(fleet []models.UserFleetEntry) models.FleetOverview {
	overview := models.FleetOverview{
		TotalVehicles: len(fleet),
	}

	for _, e := range fleet {
		overview.TotalCargo += e.Cargo
		overview.TotalPledgeValue += e.PledgePrice
		overview.MinCrew += e.CrewMin
		overview.MaxCrew += e.CrewMax

		if e.ProductionStatus == "flight_ready" {
			overview.FlightReady++
		} else if e.ProductionStatus != "" {
			overview.InConcept++
		}

		if e.IsLifetime {
			overview.LTICount++
		} else if e.InsuranceTypeID != nil {
			overview.NonLTICount++
		}
	}

	return overview
}

func buildSizeDistribution(fleet []models.UserFleetEntry) map[string]int {
	dist := make(map[string]int)
	for _, e := range fleet {
		size := "Unknown"
		if e.SizeLabel != "" {
			size = e.SizeLabel
		}
		dist[size]++
	}
	return dist
}

func buildRoleCategories(fleet []models.UserFleetEntry) map[string][]string {
	categories := make(map[string][]string)
	for _, e := range fleet {
		category := "Uncategorised"
		for key, cat := range roleMapping {
			if strings.EqualFold(e.Focus, key) || strings.Contains(strings.ToLower(e.Focus), strings.ToLower(key)) {
				category = cat
				break
			}
		}

		displayName := e.VehicleName
		if e.CustomName != "" {
			displayName = e.VehicleName + " \"" + e.CustomName + "\""
		}
		categories[category] = append(categories[category], displayName)
	}
	return categories
}

func buildGapAnalysis(fleet []models.UserFleetEntry, allVehicles []models.Vehicle) []models.GapItem {
	// Collect roles the user has
	ownedRoles := make(map[string]bool)
	for _, e := range fleet {
		if e.Focus != "" {
			ownedRoles[strings.ToLower(e.Focus)] = true
		}
	}

	// Collect all possible roles from the vehicle reference database
	allRoles := make(map[string]int)
	for _, v := range allVehicles {
		if v.Focus != "" {
			allRoles[strings.ToLower(v.Focus)]++
		}
	}

	var gaps []models.GapItem

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

func buildRedundancies(fleet []models.UserFleetEntry) []models.RedundancyGroup {
	roleShips := make(map[string][]string)
	for _, e := range fleet {
		focus := "Unknown"
		if e.Focus != "" {
			focus = e.Focus
		}
		displayName := e.VehicleName
		if e.CustomName != "" {
			displayName = e.VehicleName + " \"" + e.CustomName + "\""
		}
		roleShips[focus] = append(roleShips[focus], displayName)
	}

	var redundancies []models.RedundancyGroup
	for role, ships := range roleShips {
		if len(ships) > 1 {
			redundancies = append(redundancies, models.RedundancyGroup{
				Role:  role,
				Ships: ships,
			})
		}
	}

	return redundancies
}

func buildInsuranceSummary(fleet []models.UserFleetEntry) models.InsuranceSummary {
	summary := models.InsuranceSummary{}

	for _, e := range fleet {
		entry := models.InsuranceEntry{
			ShipName:       e.VehicleName,
			CustomName:     e.CustomName,
			PledgeCost:     e.PledgeCost,
			PledgeName:     e.PledgeName,
			PledgeDate:     e.PledgeDate,
			InsuranceLabel: e.InsuranceLabel,
			DurationMonths: e.DurationMonths,
			IsLifetime:     e.IsLifetime,
			Warbond:        e.Warbond,
		}

		if e.IsLifetime {
			summary.LTIShips = append(summary.LTIShips, entry)
		} else if e.InsuranceTypeID != nil {
			summary.NonLTIShips = append(summary.NonLTIShips, entry)
		} else {
			summary.UnknownShips = append(summary.UnknownShips, entry)
		}
	}

	return summary
}
