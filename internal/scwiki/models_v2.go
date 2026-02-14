package scwiki

// V2 models for scunpacked-data repository (not API)
// These match the actual JSON structure from the scunpacked-data repo

// ManufacturerV2 represents a manufacturer from manufacturers.json
type ManufacturerV2 struct {
	Reference string `json:"reference"` // UUID field in scunpacked-data
	Name      string `json:"name"`
	Code      string `json:"code"`
}

// ManufacturerSimple is the nested manufacturer object in ships
type ManufacturerSimple struct {
	UUID string `json:"UUID"`
	Name string `json:"Name"`
}

// LoadoutItem represents a hardpoint with equipped item (recursive structure)
type LoadoutItem struct {
	HardpointName    string        `json:"HardpointName"`
	ClassName        string        `json:"ClassName"`
	UUID             string        `json:"UUID"`
	Name             string        `json:"Name"`
	ManufacturerName string        `json:"ManufacturerName"`
	Type             string        `json:"Type"`
	Grade            int           `json:"Grade"`
	Editable         bool          `json:"Editable"`
	EditableChildren bool          `json:"EditableChildren"`
	MaxSize          int           `json:"MaxSize"`
	MinSize          int           `json:"MinSize"`
	Children         []LoadoutItem `json:"Children,omitempty"` // Recursive for nested ports
}

// VehicleV2 represents a ship from ships/*.json
type VehicleV2 struct {
	UUID         string                 `json:"UUID"` // Note: capitalized in scunpacked-data
	ClassName    string                 `json:"ClassName"`
	Name         string                 `json:"Name"`
	Description  string                 `json:"Description"`
	Career       string                 `json:"Career"`
	Role         string                 `json:"Role"`
	Manufacturer ManufacturerSimple     `json:"Manufacturer"`
	Size         int                    `json:"Size"`
	Length       float64                `json:"Length"`
	Width        float64                `json:"Width"`
	Height       float64                `json:"Height"`
	Mass         float64                `json:"Mass"`
	MassTotal    float64                `json:"MassTotal"`
	MassLoadout  float64                `json:"MassLoadout"`
	Crew         int                    `json:"Crew"` // Note: plain integer in scunpacked-data
	Cargo        float64                `json:"Cargo"`
	IsSpaceship  bool                   `json:"IsSpaceship"`
	IsVehicle    bool                   `json:"IsVehicle"`
	IsGravlev    bool                   `json:"IsGravlev"`
	Health       float64                `json:"Health"`
	ShieldHp     float64                `json:"ShieldHp"`
	ShieldsTotal float64                `json:"ShieldsTotal"`
	FlightChars  map[string]interface{} `json:"FlightCharacteristics"`
	Agility      map[string]interface{} `json:"Agility"`
	Loadout      []LoadoutItem          `json:"Loadout"`
	GameVersion  string                 `json:"-"` // Not in file, set externally
}

// PortV2 represents a hardpoint/port stored in the database (flattened from Loadout)
type PortV2 struct {
	UUID             string `json:"uuid"`
	HardpointName    string `json:"hardpoint_name"`
	Name             string `json:"name"`
	CategoryLabel    string `json:"category_label"`
	SizeMin          int    `json:"size_min"`
	SizeMax          int    `json:"size_max"`
	PortType         string `json:"port_type"`
	ClassName        string `json:"class_name"`
	EquippedItemUUID string `json:"equipped_item_uuid"`
	Editable         bool   `json:"editable"`
	EditableChildren bool   `json:"editable_children"`
}

// ItemV2 represents an item from ship-items.json or fps-items.json
type ItemV2 struct {
	UUID               string                 `json:"uuid"`
	Name               string                 `json:"name"`
	ClassName          string                 `json:"className"`
	ManufacturerUUID   string                 `json:"manufacturer_uuid"`
	ManufacturerName   string                 `json:"manufacturer_name"`
	Type               string                 `json:"type"`
	SubType            string                 `json:"subType"`
	Classification     string                 `json:"classification"`
	Size               int                    `json:"size"`
	Grade              int                    `json:"grade"`
	Class              string                 `json:"class"`
	Width              float64                `json:"width"`
	Height             float64                `json:"height"`
	Length             float64                `json:"length"`
	Mass               float64                `json:"mass"`
	VolumeSCU          float64                `json:"volume"`
	Description        string                 `json:"description"`
	Metadata           map[string]interface{} `json:"-"` // All extra fields
	IsBaseVariant      bool                   `json:"isBaseVariant"`
	Tags               []string               `json:"tags"`
	GameVersion        string                 `json:"gameVersion"`
}

// Item type filters

var ShipItemTypes = map[string]bool{
	"WeaponGun":                    true,
	"WeaponMissile":                true,
	"Missile":                      true,
	"TurretBase":                   true,
	"PowerPlant":                   true,
	"Cooler":                       true,
	"QuantumDrive":                 true,
	"QuantumFuelTank":              true,
	"Shield":                       true,
	"ShieldGenerator":              true,
	"Armor":                        true,
	"MainThruster":                 true,
	"ManneuverThruster":            true,
	"HydrogenFuelTank":             true,
	"HydrogenFuelIntake":           true,
	"QuantumInterdictionGenerator": true,
	"EMP":                          true,
	"SelfDestruct":                 true,
	"Radar":                        true,
	"Avionics":                     true,
	"Scanner":                      true,
	"Ping":                         true,
	"CargoGrid":                    true,
	"VehicleSeat":                  true,
	"Door":                         true,
}

var FPSItemTypes = map[string]bool{
	"WeaponPersonal":   true,
	"Armor":            true,
	"Backpack":         true,
	"Helmet":           true,
	"Undersuit":        true,
	"MedPen":           true,
	"Magazine":         true,
	"Ammo":             true,
	"Gadget":           true,
	"WeaponAttachment": true,
	"Grenade":          true,
	"MiningTool":       true,
	"TractorBeam":      true,
	"Consumable":       true,
}
