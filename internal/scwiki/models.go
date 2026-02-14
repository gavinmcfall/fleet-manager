package scwiki

import "time"

// GameVersion represents a Star Citizen game version
type GameVersion struct {
	UUID        string    `json:"uuid"`
	Code        string    `json:"code"`
	Channel     string    `json:"channel"`
	IsDefault   bool      `json:"is_default"`
	ReleasedAt  time.Time `json:"released_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Manufacturer represents a ship/item manufacturer
type Manufacturer struct {
	UUID        string    `json:"uuid"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	KnownFor    string    `json:"known_for"`
	Description string    `json:"description"`
	LogoURL     string    `json:"logo_url"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Item represents an in-game item (component, weapon, etc.)
type Item struct {
	UUID         string                 `json:"uuid"`
	ClassName    string                 `json:"class_name"`
	Name         string                 `json:"name"`
	Slug         string                 `json:"slug"`
	Manufacturer *Manufacturer          `json:"manufacturer"`
	Type         string                 `json:"type"`
	SubType      string                 `json:"sub_type"`
	Size         int                    `json:"size"`
	Grade        string                 `json:"grade"`
	GameVersion  *GameVersion           `json:"game_version"`
	RawData      map[string]interface{} `json:"-"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

// Port represents a vehicle hardpoint/port
type Port struct {
	UUID          string `json:"uuid"`
	Name          string `json:"name"`
	CategoryLabel string `json:"category_label"`
	SizeMin       int    `json:"size_min"`
	SizeMax       int    `json:"size_max"`
	PortType      string `json:"port_type"`
	EquippedItem  *Item  `json:"equipped_item,omitempty"`
}

// Vehicle represents an in-game vehicle/ship
type Vehicle struct {
	UUID               string                 `json:"uuid"`
	ClassName          string                 `json:"class_name"`
	Name               string                 `json:"name"`
	Slug               string                 `json:"slug"`
	Manufacturer       *Manufacturer          `json:"manufacturer"`
	Size               int                    `json:"-"` // Ignored during unmarshal - API now returns localized object
	SizeClass          int                    `json:"size_class"`
	Career             string                 `json:"career"`
	Role               string                 `json:"role"`
	IsVehicle          bool                   `json:"is_vehicle"`
	IsGravlev          bool                   `json:"is_gravlev"`
	IsSpaceship        bool                   `json:"is_spaceship"`
	MassTotal          float64                `json:"mass_total"`
	CargoCapacity      float64                `json:"cargo_capacity"`
	VehicleInventory   float64                `json:"vehicle_inventory"`
	Crew               *VehicleCrew           `json:"crew"`
	Speed              *VehicleSpeed          `json:"speed"`
	Ports              *[]Port                `json:"ports,omitempty"` // Included when ?include=ports
	GameVersion        *GameVersion           `json:"game_version"`
	RawData            map[string]interface{} `json:"-"` // Store full API response
	CreatedAt          time.Time              `json:"created_at"`
	UpdatedAt          time.Time              `json:"updated_at"`
}

// VehicleCrew represents crew requirements
type VehicleCrew struct {
	Min int `json:"min"`
	Max int `json:"max"`
}

// VehicleSpeed represents vehicle speed data
type VehicleSpeed struct {
	SCM float64 `json:"scm"`
	Max float64 `json:"max"`
}

// ShipMatrixVehicle represents ship matrix data
type ShipMatrixVehicle struct {
	UUID           string    `json:"uuid"`
	Name           string    `json:"name"`
	Slug           string    `json:"slug"`
	PledgePrice    float64   `json:"pledge_price"`
	PriceAUEC      float64   `json:"price_auec"`
	SCVehicleUUID  string    `json:"sc_vehicle_uuid"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// CommLink represents an official Star Citizen news post
type CommLink struct {
	UUID        string    `json:"uuid"`
	Title       string    `json:"title"`
	Slug        string    `json:"slug"`
	PublishedAt time.Time `json:"published_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Galactapedia represents a lore entry
type Galactapedia struct {
	UUID      string    `json:"uuid"`
	Title     string    `json:"title"`
	Slug      string    `json:"slug"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CelestialObject represents a celestial object
type CelestialObject struct {
	UUID      string    `json:"uuid"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Starsystem represents a star system
type Starsystem struct {
	UUID      string    `json:"uuid"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// SyncMetadata tracks sync state for each endpoint
type SyncMetadata struct {
	Endpoint          string    `json:"endpoint"`
	LastSyncAt        time.Time `json:"last_sync_at"`
	LastUpdatedRecord time.Time `json:"last_updated_record"`
	TotalRecords      int       `json:"total_records"`
	SyncStatus        string    `json:"sync_status"`
	ErrorMessage      string    `json:"error_message"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}
