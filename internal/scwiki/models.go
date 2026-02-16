package scwiki

import (
	"encoding/json"
	"fmt"
	"time"
)

// GameVersion represents a Star Citizen game version
type GameVersion struct {
	UUID       string    `json:"uuid"`
	Code       string    `json:"code"`
	Channel    string    `json:"channel"`
	IsDefault  bool      `json:"is_default"`
	ReleasedAt time.Time `json:"released_at"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// Manufacturer represents a ship/item manufacturer
type Manufacturer struct {
	UUID        string    `json:"uuid"`
	Name        string    `json:"name"`
	Code        string    `json:"code"`
	Slug        string    `json:"slug"`
	KnownFor    string    `json:"known_for"`
	Description string    `json:"description"`
	LogoURL     string    `json:"logo_url"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// FlexString handles JSON values that can be string or number (e.g. grade: "A" or grade: 1)
type FlexString string

func (f *FlexString) UnmarshalJSON(data []byte) error {
	// Try string first
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		*f = FlexString(s)
		return nil
	}
	// Try number
	var n float64
	if err := json.Unmarshal(data, &n); err == nil {
		*f = FlexString(fmt.Sprintf("%v", n))
		return nil
	}
	// Null or other
	*f = ""
	return nil
}

// LocalizedString handles localized API fields like {"en_EN": "flight-ready", "de_DE": "..."}
type LocalizedString struct {
	EnEN string `json:"en_EN"`
}

// VehicleSizes represents dimensions from the API sizes object
type VehicleSizes struct {
	Length float64 `json:"length"`
	Beam   float64 `json:"beam"`
	Height float64 `json:"height"`
}

// VehicleLoaner represents a loaner ship entry
type VehicleLoaner struct {
	UUID string `json:"uuid"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

// VehicleSKU represents a purchasable SKU for a vehicle
type VehicleSKU struct {
	Title     string  `json:"title"`
	Price     float64 `json:"price"`
	Available bool    `json:"available"`
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
	Grade        FlexString             `json:"grade"`
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

// Vehicle represents an in-game vehicle/ship from the SC Wiki API
type Vehicle struct {
	UUID             string                 `json:"uuid"`
	ClassName        string                 `json:"class_name"`
	Name             string                 `json:"name"`
	Slug             string                 `json:"slug"`
	Manufacturer     *Manufacturer          `json:"manufacturer"`
	Size             int                    `json:"-"` // Ignored during unmarshal - API returns localized object
	SizeClass        int                    `json:"size_class"`
	Career           string                 `json:"career"`
	Role             string                 `json:"role"`
	IsVehicle        bool                   `json:"is_vehicle"`
	IsGravlev        bool                   `json:"is_gravlev"`
	IsSpaceship      bool                   `json:"is_spaceship"`
	MassTotal        float64                `json:"mass_total"`
	CargoCapacity    float64                `json:"cargo_capacity"`
	VehicleInventory float64                `json:"vehicle_inventory"`
	Crew             *VehicleCrew           `json:"crew"`
	Speed            *VehicleSpeed          `json:"speed"`
	Ports            *[]Port                `json:"ports,omitempty"`
	GameVersion      *GameVersion           `json:"game_version"`
	RawData          map[string]interface{} `json:"-"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`

	// Dimensions
	Sizes *VehicleSizes `json:"sizes"`

	// Pricing & store
	MSRP      float64 `json:"msrp"`
	PledgeURL string  `json:"pledge_url"`

	// Status (localized objects)
	ProductionStatus *LocalizedString `json:"production_status"`
	Description      *LocalizedString `json:"description"`
	SizeLabel        *LocalizedString `json:"size"`

	// Combat
	Health   float64 `json:"health"`
	ShieldHP float64 `json:"shield_hp"`

	// Focus (localized array)
	Foci []LocalizedString `json:"foci"`

	// Loaners (included when ?include=loaner)
	Loaners []VehicleLoaner `json:"loaner"`

	// SKUs
	SKUs []VehicleSKU `json:"skus"`
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
