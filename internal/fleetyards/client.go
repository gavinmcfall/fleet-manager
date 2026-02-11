package fleetyards

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
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
	Slug             string        `json:"slug"`
	Name             string        `json:"name"`
	SCIdentifier     string        `json:"scIdentifier"`
	Focus            string        `json:"focus"`
	SizeLabel        string        `json:"sizeLabel"`
	Length           float64       `json:"length"`
	Beam             float64       `json:"beam"`
	Height           float64       `json:"height"`
	Mass             float64       `json:"mass"`
	Cargo            float64       `json:"cargo"`
	MinCrew          int           `json:"minCrew"`
	MaxCrew          int           `json:"maxCrew"`
	PledgePrice      float64       `json:"pledgePrice"`
	ProductionStatus string        `json:"productionStatus"`
	Description      string        `json:"description"`
	Classification   string        `json:"classification"`
	Links            *apiLinks     `json:"links"`
	Manufacturer     *apiMfr       `json:"manufacturer"`
	Media            *apiMedia     `json:"media"`
	Speeds           *apiSpeeds    `json:"speeds"`
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
}

type apiSpeeds struct {
	SCMSpeed float64 `json:"scmSpeed"`
}

type apiVehicle struct {
	Name             string `json:"name"`
	Slug             string `json:"slug"`
	ShipCode         string `json:"shipCode"`
	ManufacturerName string `json:"manufacturerName"`
	ManufacturerCode string `json:"manufacturerCode"`
	ShipName         string `json:"shipName"`
	Wanted           bool   `json:"wanted"`
	Flagship         bool   `json:"flagship"`
	Public           bool   `json:"public"`
	NameVisible      bool   `json:"nameVisible"`
	SaleNotify       bool   `json:"saleNotify"`
}

// --- Fetch methods ---

// FetchAllShips retrieves the full ship database from FleetYards API with pagination
func (c *Client) FetchAllShips(ctx context.Context) ([]models.Ship, error) {
	var allShips []models.Ship
	page := 1
	perPage := 50

	for {
		url := fmt.Sprintf("%s/v1/models?page=%d&perPage=%d", c.baseURL, page, perPage)
		log.Debug().Str("url", url).Int("page", page).Msg("fetching ships page")

		body, err := c.doGet(ctx, url)
		if err != nil {
			return allShips, fmt.Errorf("fetching page %d: %w", page, err)
		}

		var apiShips []apiShip
		if err := json.Unmarshal(body, &apiShips); err != nil {
			return allShips, fmt.Errorf("parsing page %d: %w", page, err)
		}

		if len(apiShips) == 0 {
			break
		}

		for _, as := range apiShips {
			ship := convertAPIShip(as, body)
			allShips = append(allShips, ship)
		}

		log.Info().Int("page", page).Int("count", len(apiShips)).Int("total", len(allShips)).Msg("fetched ships page")

		if len(apiShips) < perPage {
			break
		}

		page++
		// Be polite to the API
		time.Sleep(500 * time.Millisecond)
	}

	return allShips, nil
}

// FetchHangar retrieves a user's public hangar from FleetYards API
func (c *Client) FetchHangar(ctx context.Context, username string) ([]models.Vehicle, error) {
	if username == "" {
		return nil, fmt.Errorf("username is required")
	}

	url := fmt.Sprintf("%s/v1/users/%s/vehicles", c.baseURL, username)
	log.Debug().Str("url", url).Str("user", username).Msg("fetching hangar")

	body, err := c.doGet(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("fetching hangar: %w", err)
	}

	var apiVehicles []apiVehicle
	if err := json.Unmarshal(body, &apiVehicles); err != nil {
		return nil, fmt.Errorf("parsing hangar: %w", err)
	}

	var vehicles []models.Vehicle
	for _, av := range apiVehicles {
		v := models.Vehicle{
			ShipSlug:         av.Slug,
			ShipName:         av.ShipName,
			CustomName:       av.Name,
			ManufacturerName: av.ManufacturerName,
			ManufacturerCode: av.ManufacturerCode,
			Flagship:         av.Flagship,
			Public:           av.Public,
			Source:           "fleetyards",
		}
		vehicles = append(vehicles, v)
	}

	log.Info().Int("count", len(vehicles)).Str("user", username).Msg("fetched hangar")
	return vehicles, nil
}

// FetchShipDetail fetches detailed info for a single ship
func (c *Client) FetchShipDetail(ctx context.Context, slug string) (*models.Ship, error) {
	url := fmt.Sprintf("%s/v1/models/%s", c.baseURL, slug)
	body, err := c.doGet(ctx, url)
	if err != nil {
		return nil, err
	}

	var as apiShip
	if err := json.Unmarshal(body, &as); err != nil {
		return nil, err
	}

	ship := convertAPIShip(as, body)
	return &ship, nil
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
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body[:min(200, len(body))]))
	}

	return io.ReadAll(resp.Body)
}

// GetTotalPages reads the total page count from the response headers
func getTotalPages(resp *http.Response) int {
	total := resp.Header.Get("X-Total-Pages")
	if total == "" {
		return 1
	}
	n, _ := strconv.Atoi(total)
	return n
}

func convertAPIShip(as apiShip, rawJSON []byte) models.Ship {
	ship := models.Ship{
		Slug:             as.Slug,
		Name:             as.Name,
		SCIdentifier:     as.SCIdentifier,
		Focus:            as.Focus,
		SizeLabel:        as.SizeLabel,
		Length:           as.Length,
		Beam:             as.Beam,
		Height:           as.Height,
		Mass:             as.Mass,
		Cargo:            as.Cargo,
		MinCrew:          as.MinCrew,
		MaxCrew:          as.MaxCrew,
		PledgePrice:      as.PledgePrice,
		ProductionStatus: as.ProductionStatus,
		Description:      as.Description,
		Classification:   as.Classification,
	}

	if as.Manufacturer != nil {
		ship.ManufacturerName = as.Manufacturer.Name
		ship.ManufacturerCode = as.Manufacturer.Code
	}

	if as.Media != nil && as.Media.StoreImage != nil {
		ship.ImageURL = as.Media.StoreImage.Source
	}

	if as.Links != nil {
		ship.FleetYardsURL = as.Links.FleetYardsURL
	}

	if as.Speeds != nil {
		ship.SCMSpeed = as.Speeds.SCMSpeed
	}

	// Store the per-item JSON is expensive for bulk, skip for now
	// ship.RawJSON = string(rawJSON)

	return ship
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
