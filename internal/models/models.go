package models

import "time"

// Ship represents a Star Citizen ship/vehicle from the FleetYards database
type Ship struct {
	ID                int       `json:"id"`
	Slug              string    `json:"slug"`
	Name              string    `json:"name"`
	SCIdentifier      string    `json:"sc_identifier"`
	ManufacturerName  string    `json:"manufacturer_name"`
	ManufacturerCode  string    `json:"manufacturer_code"`
	Focus             string    `json:"focus"`
	SizeLabel         string    `json:"size_label"`
	Length             float64   `json:"length"`
	Beam               float64   `json:"beam"`
	Height             float64   `json:"height"`
	Mass               float64   `json:"mass"`
	Cargo              float64   `json:"cargo"`
	MinCrew            int       `json:"min_crew"`
	MaxCrew            int       `json:"max_crew"`
	SCMSpeed           float64   `json:"scm_speed"`
	PledgePrice        float64   `json:"pledge_price"`
	ProductionStatus   string    `json:"production_status"`
	Description        string    `json:"description"`
	Classification     string    `json:"classification"`
	ImageURL           string    `json:"image_url"`
	FleetYardsURL      string    `json:"fleetyards_url"`
	LastSyncedAt       time.Time `json:"last_synced_at"`
	RawJSON            string    `json:"-"`
}

// Vehicle represents a ship in the user's hangar (from FleetYards public API)
type Vehicle struct {
	ID              int       `json:"id"`
	ShipSlug        string    `json:"ship_slug"`
	ShipName        string    `json:"ship_name"`
	CustomName      string    `json:"custom_name"`
	ManufacturerName string   `json:"manufacturer_name"`
	ManufacturerCode string   `json:"manufacturer_code"`
	Flagship        bool      `json:"flagship"`
	Public          bool      `json:"public"`
	Loaner          bool      `json:"loaner"`
	PaintName       string    `json:"paint_name"`
	Source          string    `json:"source"` // "fleetyards" or "hangarxplor"
	LastSyncedAt    time.Time `json:"last_synced_at"`

	// Joined from ships table
	Ship *Ship `json:"ship,omitempty"`

	// From HangarXplor import
	HangarImport *HangarImportDetail `json:"hangar_import,omitempty"`
}

// HangarImportDetail stores insurance/pledge data from HangarXplor
type HangarImportDetail struct {
	ID          int       `json:"id"`
	VehicleID   int       `json:"vehicle_id"`
	ShipSlug    string    `json:"ship_slug"`
	ShipCode    string    `json:"ship_code"`
	LTI         bool      `json:"lti"`
	Warbond     bool      `json:"warbond"`
	PledgeID    string    `json:"pledge_id"`
	PledgeName  string    `json:"pledge_name"`
	PledgeDate  string    `json:"pledge_date"`
	PledgeCost  string    `json:"pledge_cost"`
	EntityType  string    `json:"entity_type"`
	ImportedAt  time.Time `json:"imported_at"`
}

// HangarXplorEntry represents a single entry from HangarXplor JSON export
type HangarXplorEntry struct {
	Unidentified     string `json:"unidentified,omitempty"`
	ShipCode         string `json:"ship_code"`
	ShipName         string `json:"ship_name,omitempty"`
	ManufacturerCode string `json:"manufacturer_code"`
	ManufacturerName string `json:"manufacturer_name"`
	Lookup           string `json:"lookup,omitempty"`
	LTI              bool   `json:"lti"`
	Name             string `json:"name"`
	Warbond          bool   `json:"warbond"`
	EntityType       string `json:"entity_type"`
	PledgeID         string `json:"pledge_id"`
	PledgeName       string `json:"pledge_name"`
	PledgeDate       string `json:"pledge_date"`
	PledgeCost       string `json:"pledge_cost"`
}

// SyncStatus tracks the last sync time and result
type SyncStatus struct {
	ID           int       `json:"id"`
	SyncType     string    `json:"sync_type"` // "ships", "hangar", "hangarxplor"
	Status       string    `json:"status"`    // "success", "error", "running"
	ItemCount    int       `json:"item_count"`
	ErrorMessage string    `json:"error_message,omitempty"`
	StartedAt    time.Time `json:"started_at"`
	CompletedAt  time.Time `json:"completed_at,omitempty"`
}

// FleetAnalysis represents the computed analysis of a user's fleet
type FleetAnalysis struct {
	Overview        FleetOverview       `json:"overview"`
	SizeDistribution map[string]int     `json:"size_distribution"`
	RoleCategories  map[string][]string `json:"role_categories"`
	GapAnalysis     []GapItem           `json:"gap_analysis"`
	Redundancies    []RedundancyGroup   `json:"redundancies"`
	InsuranceSummary InsuranceSummary    `json:"insurance_summary"`
}

type FleetOverview struct {
	TotalVehicles    int     `json:"total_vehicles"`
	FlightReady      int     `json:"flight_ready"`
	InConcept        int     `json:"in_concept"`
	TotalCargo       float64 `json:"total_cargo"`
	TotalPledgeValue float64 `json:"total_pledge_value"`
	MinCrew          int     `json:"min_crew"`
	MaxCrew          int     `json:"max_crew"`
	LTICount         int     `json:"lti_count"`
	NonLTICount      int     `json:"non_lti_count"`
}

type GapItem struct {
	Role        string   `json:"role"`
	Priority    string   `json:"priority"` // "high", "medium", "low"
	Description string   `json:"description"`
	Suggestions []string `json:"suggestions"`
}

type RedundancyGroup struct {
	Role    string   `json:"role"`
	Ships   []string `json:"ships"`
	Notes   string   `json:"notes"`
}

type InsuranceSummary struct {
	LTIShips    []InsuranceEntry `json:"lti_ships"`
	NonLTIShips []InsuranceEntry `json:"non_lti_ships"`
	UnknownShips []InsuranceEntry `json:"unknown_ships"`
}

type InsuranceEntry struct {
	ShipName   string `json:"ship_name"`
	CustomName string `json:"custom_name,omitempty"`
	PledgeCost string `json:"pledge_cost,omitempty"`
	PledgeName string `json:"pledge_name,omitempty"`
	PledgeDate string `json:"pledge_date,omitempty"`
	LTI        bool   `json:"lti"`
	Warbond    bool   `json:"warbond"`
}
