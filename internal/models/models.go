package models

import "time"

// --- Lookup Types ---

type VehicleType struct {
	ID    int    `json:"id"`
	Key   string `json:"key"`
	Label string `json:"label"`
}

type InsuranceType struct {
	ID             int    `json:"id"`
	Key            string `json:"key"`
	Label          string `json:"label"`
	DurationMonths *int   `json:"duration_months,omitempty"`
	IsLifetime     bool   `json:"is_lifetime"`
}

type SyncSource struct {
	ID    int    `json:"id"`
	Key   string `json:"key"`
	Label string `json:"label"`
}

type ProductionStatus struct {
	ID    int    `json:"id"`
	Key   string `json:"key"`
	Label string `json:"label"`
}

// --- Core Reference Data ---

type Manufacturer struct {
	ID          int       `json:"id"`
	UUID        string    `json:"uuid"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Code        string    `json:"code,omitempty"`
	KnownFor    string    `json:"known_for,omitempty"`
	Description string    `json:"description,omitempty"`
	LogoURL     string    `json:"logo_url,omitempty"`
	RawData     string    `json:"-"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type GameVersion struct {
	ID         int        `json:"id"`
	UUID       string     `json:"uuid"`
	Code       string     `json:"code"`
	Channel    string     `json:"channel,omitempty"`
	IsDefault  bool       `json:"is_default"`
	ReleasedAt *time.Time `json:"released_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// Vehicle is the unified reference table for all ships/vehicles in the game.
// Merges old 'ships' (FleetYards) + 'sc_vehicles' (SC Wiki).
type Vehicle struct {
	ID                 int       `json:"id"`
	UUID               string    `json:"uuid,omitempty"`
	Slug               string    `json:"slug"`
	Name               string    `json:"name"`
	ClassName          string    `json:"class_name,omitempty"`
	ManufacturerID     *int      `json:"manufacturer_id,omitempty"`
	VehicleTypeID      *int      `json:"vehicle_type_id,omitempty"`
	ProductionStatusID *int      `json:"production_status_id,omitempty"`
	Size               int       `json:"size,omitempty"`
	SizeLabel          string    `json:"size_label,omitempty"`
	Focus              string    `json:"focus,omitempty"`
	Classification     string    `json:"classification,omitempty"`
	Description        string    `json:"description,omitempty"`
	Length             float64   `json:"length,omitempty"`
	Beam               float64   `json:"beam,omitempty"`
	Height             float64   `json:"height,omitempty"`
	Mass               float64   `json:"mass,omitempty"`
	Cargo              float64   `json:"cargo,omitempty"`
	VehicleInventory   float64   `json:"vehicle_inventory,omitempty"`
	CrewMin            int       `json:"crew_min,omitempty"`
	CrewMax            int       `json:"crew_max,omitempty"`
	SpeedSCM           float64   `json:"speed_scm,omitempty"`
	SpeedMax           float64   `json:"speed_max,omitempty"`
	Health             float64   `json:"health,omitempty"`
	PledgePrice        float64   `json:"pledge_price,omitempty"`
	PriceAUEC          float64   `json:"price_auec,omitempty"`
	OnSale             bool      `json:"on_sale,omitempty"`
	ImageURL           string    `json:"image_url,omitempty"`
	ImageURLSmall      string    `json:"image_url_small,omitempty"`
	ImageURLMedium     string    `json:"image_url_medium,omitempty"`
	ImageURLLarge      string    `json:"image_url_large,omitempty"`
	PledgeURL          string    `json:"pledge_url,omitempty"`
	GameVersionID      *int      `json:"game_version_id,omitempty"`
	RawData            string    `json:"-"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`

	// Joined fields (not stored, populated via query)
	ManufacturerName string `json:"manufacturer_name,omitempty"`
	ManufacturerCode string `json:"manufacturer_code,omitempty"`
	ProductionStatus string `json:"production_status,omitempty"`
}

type Port struct {
	ID               int       `json:"id"`
	UUID             string    `json:"uuid"`
	VehicleID        int       `json:"vehicle_id"`
	ParentPortID     *int      `json:"parent_port_id,omitempty"`
	Name             string    `json:"name"`
	Position         string    `json:"position,omitempty"`
	CategoryLabel    string    `json:"category_label,omitempty"`
	SizeMin          int       `json:"size_min,omitempty"`
	SizeMax          int       `json:"size_max,omitempty"`
	PortType         string    `json:"port_type,omitempty"`
	PortSubtype      string    `json:"port_subtype,omitempty"`
	EquippedItemUUID string    `json:"equipped_item_uuid,omitempty"`
	Editable         bool      `json:"editable"`
	Health           float64   `json:"health,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
}

type Component struct {
	ID             int       `json:"id"`
	UUID           string    `json:"uuid"`
	Name           string    `json:"name"`
	Slug           string    `json:"slug,omitempty"`
	ClassName      string    `json:"class_name,omitempty"`
	ManufacturerID *int      `json:"manufacturer_id,omitempty"`
	Type           string    `json:"type"`
	SubType        string    `json:"sub_type,omitempty"`
	Size           int       `json:"size,omitempty"`
	Grade          string    `json:"grade,omitempty"`
	Description    string    `json:"description,omitempty"`
	GameVersionID  *int      `json:"game_version_id,omitempty"`
	RawData        string    `json:"-"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type FPSWeapon struct {
	ID             int       `json:"id"`
	UUID           string    `json:"uuid"`
	Name           string    `json:"name"`
	Slug           string    `json:"slug,omitempty"`
	ClassName      string    `json:"class_name,omitempty"`
	ManufacturerID *int      `json:"manufacturer_id,omitempty"`
	SubType        string    `json:"sub_type,omitempty"`
	Size           int       `json:"size,omitempty"`
	Description    string    `json:"description,omitempty"`
	GameVersionID  *int      `json:"game_version_id,omitempty"`
	RawData        string    `json:"-"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type FPSArmour struct {
	ID             int       `json:"id"`
	UUID           string    `json:"uuid"`
	Name           string    `json:"name"`
	Slug           string    `json:"slug,omitempty"`
	ClassName      string    `json:"class_name,omitempty"`
	ManufacturerID *int      `json:"manufacturer_id,omitempty"`
	SubType        string    `json:"sub_type,omitempty"`
	Size           int       `json:"size,omitempty"`
	Grade          string    `json:"grade,omitempty"`
	Description    string    `json:"description,omitempty"`
	GameVersionID  *int      `json:"game_version_id,omitempty"`
	RawData        string    `json:"-"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type FPSAttachment struct {
	ID             int       `json:"id"`
	UUID           string    `json:"uuid"`
	Name           string    `json:"name"`
	Slug           string    `json:"slug,omitempty"`
	ClassName      string    `json:"class_name,omitempty"`
	ManufacturerID *int      `json:"manufacturer_id,omitempty"`
	SubType        string    `json:"sub_type,omitempty"`
	Size           int       `json:"size,omitempty"`
	Description    string    `json:"description,omitempty"`
	GameVersionID  *int      `json:"game_version_id,omitempty"`
	RawData        string    `json:"-"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type FPSAmmo struct {
	ID             int       `json:"id"`
	UUID           string    `json:"uuid"`
	Name           string    `json:"name"`
	Slug           string    `json:"slug,omitempty"`
	ClassName      string    `json:"class_name,omitempty"`
	ManufacturerID *int      `json:"manufacturer_id,omitempty"`
	SubType        string    `json:"sub_type,omitempty"`
	Description    string    `json:"description,omitempty"`
	GameVersionID  *int      `json:"game_version_id,omitempty"`
	RawData        string    `json:"-"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type FPSUtility struct {
	ID             int       `json:"id"`
	UUID           string    `json:"uuid"`
	Name           string    `json:"name"`
	Slug           string    `json:"slug,omitempty"`
	ClassName      string    `json:"class_name,omitempty"`
	ManufacturerID *int      `json:"manufacturer_id,omitempty"`
	SubType        string    `json:"sub_type,omitempty"`
	Description    string    `json:"description,omitempty"`
	GameVersionID  *int      `json:"game_version_id,omitempty"`
	RawData        string    `json:"-"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type Paint struct {
	ID             int       `json:"id"`
	UUID           string    `json:"uuid,omitempty"`
	Name           string    `json:"name"`
	Slug           string    `json:"slug,omitempty"`
	ClassName      string    `json:"class_name,omitempty"`
	VehicleID      *int      `json:"vehicle_id,omitempty"`
	Description    string    `json:"description,omitempty"`
	ImageURL       string    `json:"image_url,omitempty"`
	ImageURLSmall  string    `json:"image_url_small,omitempty"`
	ImageURLMedium string    `json:"image_url_medium,omitempty"`
	ImageURLLarge  string    `json:"image_url_large,omitempty"`
	RawData        string    `json:"-"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	// Joined fields (not stored, populated via query)
	VehicleName string `json:"vehicle_name,omitempty"`
	VehicleSlug string `json:"vehicle_slug,omitempty"`
}

type VehicleLoaner struct {
	VehicleID int `json:"vehicle_id"`
	LoanerID  int `json:"loaner_id"`
}

// --- User Data ---

type User struct {
	ID        int       `json:"id"`
	Username  string    `json:"username"`
	Handle    string    `json:"handle,omitempty"`
	Email     string    `json:"email,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UserFleetEntry represents a ship in the user's fleet.
// This IS the user's fleet — insurance, pledge data, custom names live here.
// Only populated from HangarXplor imports. Auto-enriched from reference tables via FK JOINs.
type UserFleetEntry struct {
	ID              int       `json:"id"`
	UserID          int       `json:"user_id"`
	VehicleID       int       `json:"vehicle_id"`
	InsuranceTypeID *int      `json:"insurance_type_id,omitempty"`
	Warbond         bool      `json:"warbond"`
	IsLoaner        bool      `json:"is_loaner"`
	PledgeID        string    `json:"pledge_id,omitempty"`
	PledgeName      string    `json:"pledge_name,omitempty"`
	PledgeCost      string    `json:"pledge_cost,omitempty"`
	PledgeDate      string    `json:"pledge_date,omitempty"`
	CustomName      string    `json:"custom_name,omitempty"`
	EquippedPaintID *int      `json:"equipped_paint_id,omitempty"`
	ImportedAt      time.Time `json:"imported_at"`

	// Joined fields from reference tables (populated by queries, not stored)
	VehicleName      string  `json:"vehicle_name,omitempty"`
	VehicleSlug      string  `json:"vehicle_slug,omitempty"`
	ImageURL         string  `json:"image_url,omitempty"`
	ManufacturerName string  `json:"manufacturer_name,omitempty"`
	ManufacturerCode string  `json:"manufacturer_code,omitempty"`
	InsuranceLabel   string  `json:"insurance_label,omitempty"`
	DurationMonths   *int    `json:"duration_months,omitempty"`
	IsLifetime       bool    `json:"is_lifetime,omitempty"`
	PaintName        string  `json:"paint_name,omitempty"`
	Focus            string  `json:"focus,omitempty"`
	SizeLabel        string  `json:"size_label,omitempty"`
	Cargo            float64 `json:"cargo,omitempty"`
	CrewMin          int     `json:"crew_min,omitempty"`
	CrewMax          int     `json:"crew_max,omitempty"`
	PledgePrice      float64 `json:"pledge_price,omitempty"`
	ProductionStatus string  `json:"production_status,omitempty"`
	SpeedSCM         float64 `json:"speed_scm,omitempty"`
	Classification   string  `json:"classification,omitempty"`
}

type UserPaint struct {
	ID      int `json:"id"`
	UserID  int `json:"user_id"`
	PaintID int `json:"paint_id"`
}

type UserLLMConfig struct {
	ID              int       `json:"id"`
	UserID          int       `json:"user_id"`
	Provider        string    `json:"provider"`
	EncryptedAPIKey string    `json:"-"`
	Model           string    `json:"model,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type UserSetting struct {
	ID     int    `json:"id"`
	UserID int    `json:"user_id"`
	Key    string `json:"key"`
	Value  string `json:"value"`
}

// --- Sync & Audit ---

type SyncHistory struct {
	ID           int        `json:"id"`
	SourceID     int        `json:"source_id"`
	Endpoint     string     `json:"endpoint,omitempty"`
	Status       string     `json:"status"`
	RecordCount  int        `json:"record_count"`
	ErrorMessage string     `json:"error_message,omitempty"`
	StartedAt    time.Time  `json:"started_at"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`

	// Joined field
	SourceLabel string `json:"source_label,omitempty"`
}

type AIAnalysis struct {
	ID           int64     `json:"id"`
	UserID       int       `json:"user_id"`
	CreatedAt    time.Time `json:"created_at"`
	Provider     string    `json:"provider"`
	Model        string    `json:"model"`
	VehicleCount int       `json:"vehicle_count"`
	Analysis     string    `json:"analysis"`
}

// --- Import Types ---

// HangarXplorEntry represents a single entry from HangarXplor JSON export
type HangarXplorEntry struct {
	Unidentified     string `json:"unidentified,omitempty"`
	ShipCode         string `json:"ship_code"`
	ShipName         string `json:"ship_name,omitempty"`
	ManufacturerCode string `json:"manufacturer_code"`
	ManufacturerName string `json:"manufacturer_name"`
	Lookup           string `json:"lookup,omitempty"`
	LTI              bool   `json:"lti"`
	Insurance        string `json:"insurance,omitempty"`
	Name             string `json:"name"`
	Warbond          bool   `json:"warbond"`
	EntityType       string `json:"entity_type"`
	PledgeID         string `json:"pledge_id"`
	PledgeName       string `json:"pledge_name"`
	PledgeDate       string `json:"pledge_date"`
	PledgeCost       string `json:"pledge_cost"`
}

// --- Analysis Types ---

type FleetAnalysis struct {
	Overview         FleetOverview       `json:"overview"`
	SizeDistribution map[string]int      `json:"size_distribution"`
	RoleCategories   map[string][]string `json:"role_categories"`
	GapAnalysis      []GapItem           `json:"gap_analysis"`
	Redundancies     []RedundancyGroup   `json:"redundancies"`
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
	Priority    string   `json:"priority"`
	Description string   `json:"description"`
	Suggestions []string `json:"suggestions"`
}

type RedundancyGroup struct {
	Role  string   `json:"role"`
	Ships []string `json:"ships"`
	Notes string   `json:"notes"`
}

type InsuranceSummary struct {
	LTIShips     []InsuranceEntry `json:"lti_ships"`
	NonLTIShips  []InsuranceEntry `json:"non_lti_ships"`
	UnknownShips []InsuranceEntry `json:"unknown_ships"`
}

type InsuranceEntry struct {
	ShipName       string `json:"ship_name"`
	CustomName     string `json:"custom_name,omitempty"`
	PledgeCost     string `json:"pledge_cost,omitempty"`
	PledgeName     string `json:"pledge_name,omitempty"`
	PledgeDate     string `json:"pledge_date,omitempty"`
	InsuranceLabel string `json:"insurance_label,omitempty"`
	DurationMonths *int   `json:"duration_months,omitempty"`
	IsLifetime     bool   `json:"is_lifetime"`
	Warbond        bool   `json:"warbond"`
}
