package fleetyards

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/nzvengeance/fleet-manager/internal/models"
	"github.com/rs/zerolog/log"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// --- Raw API response types ---

type apiShip struct {
	Slug             string    `json:"slug"`
	Name             string    `json:"name"`
	SCIdentifier     string    `json:"scIdentifier"`
	Focus            string    `json:"focus"`
	SizeLabel        string    `json:"sizeLabel"`
	Length           float64   `json:"length"`
	Beam             float64   `json:"beam"`
	Height           float64   `json:"height"`
	Mass             float64   `json:"mass"`
	Cargo            float64   `json:"cargo"`
	MinCrew          int       `json:"minCrew"`
	MaxCrew          int       `json:"maxCrew"`
	PledgePrice      float64   `json:"pledgePrice"`
	OnSale           bool      `json:"onSale"`
	ProductionStatus string    `json:"productionStatus"`
	Description      string    `json:"description"`
	Classification   string    `json:"classification"`
	Links            *apiLinks `json:"links"`
	Manufacturer     *apiMfr   `json:"manufacturer"`
	Media            *apiMedia `json:"media"`
	Speeds           *apiSpeeds `json:"speeds"`
}

type apiLinks struct {
	FleetYardsURL string `json:"self"`
}

type apiMfr struct {
	Name string `json:"name"`
	Code string `json:"code"`
}

type apiMedia struct {
	StoreImage *apiImage `json:"storeImage"`
}

type apiImage struct {
	Source string `json:"source"`
	Small  string `json:"small"`
	Medium string `json:"medium"`
	Large  string `json:"large"`
}

type apiSpeeds struct {
	SCMSpeed float64 `json:"scmSpeed"`
}

// --- Fetch methods ---

// FetchAllShips retrieves the full ship database from FleetYards API with pagination.
// Returns Vehicle references (slug, name, images, specs) for merging into the unified vehicles table.
func (c *Client) FetchAllShips(ctx context.Context) ([]models.Vehicle, error) {
	var allVehicles []models.Vehicle
	page := 1
	perPage := 50

	for {
		url := fmt.Sprintf("%s/v1/models?page=%d&perPage=%d", c.baseURL, page, perPage)
		log.Debug().Str("url", url).Int("page", page).Msg("fetching ships page")

		body, err := c.doGet(ctx, url)
		if err != nil {
			return allVehicles, fmt.Errorf("fetching page %d: %w", page, err)
		}

		var apiShips []apiShip
		if err := json.Unmarshal(body, &apiShips); err != nil {
			return allVehicles, fmt.Errorf("parsing page %d: %w", page, err)
		}

		if len(apiShips) == 0 {
			break
		}

		for _, as := range apiShips {
			v := convertAPIShipToVehicle(as)
			allVehicles = append(allVehicles, v)
		}

		log.Info().Int("page", page).Int("count", len(apiShips)).Int("total", len(allVehicles)).Msg("fetched ships page")

		if len(apiShips) < perPage {
			break
		}

		page++
		time.Sleep(500 * time.Millisecond)
	}

	return allVehicles, nil
}

// FetchShipDetail fetches detailed info for a single ship
func (c *Client) FetchShipDetail(ctx context.Context, slug string) (*models.Vehicle, error) {
	url := fmt.Sprintf("%s/v1/models/%s", c.baseURL, slug)
	body, err := c.doGet(ctx, url)
	if err != nil {
		return nil, err
	}

	var as apiShip
	if err := json.Unmarshal(body, &as); err != nil {
		return nil, err
	}

	v := convertAPIShipToVehicle(as)
	return &v, nil
}

// --- HTTP helpers ---

func (c *Client) doGet(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "FleetManager/1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		limit := len(body)
		if limit > 200 {
			limit = 200
		}
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body[:limit]))
	}

	return io.ReadAll(resp.Body)
}

// convertAPIShipToVehicle maps FleetYards API response to the unified Vehicle model.
// FleetYards provides images, pledge pricing, focus, specs, and the canonical slug.
func convertAPIShipToVehicle(as apiShip) models.Vehicle {
	v := models.Vehicle{
		Slug:           as.Slug,
		Name:           as.Name,
		ClassName:      as.SCIdentifier,
		Focus:          as.Focus,
		SizeLabel:      as.SizeLabel,
		Length:         as.Length,
		Beam:           as.Beam,
		Height:         as.Height,
		Mass:           as.Mass,
		Cargo:          as.Cargo,
		CrewMin:        as.MinCrew,
		CrewMax:        as.MaxCrew,
		PledgePrice:    as.PledgePrice,
		OnSale:         as.OnSale,
		Description:    as.Description,
		Classification: as.Classification,
	}

	// Map production status string to key
	switch as.ProductionStatus {
	case "flight-ready":
		v.ProductionStatus = "flight_ready"
	case "in-production":
		v.ProductionStatus = "in_production"
	case "in-concept":
		v.ProductionStatus = "in_concept"
	default:
		v.ProductionStatus = as.ProductionStatus
	}

	if as.Manufacturer != nil {
		v.ManufacturerName = as.Manufacturer.Name
		v.ManufacturerCode = as.Manufacturer.Code
	}

	if as.Media != nil && as.Media.StoreImage != nil {
		v.ImageURL = as.Media.StoreImage.Source
		v.ImageURLSmall = as.Media.StoreImage.Small
		v.ImageURLMedium = as.Media.StoreImage.Medium
		v.ImageURLLarge = as.Media.StoreImage.Large
	}

	if as.Links != nil {
		v.FleetYardsURL = as.Links.FleetYardsURL
	}

	if as.Speeds != nil {
		v.SpeedSCM = as.Speeds.SCMSpeed
	}

	return v
}
