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

type apiHangarEntry struct {
	ID     string         `json:"id"`
	Loaner bool           `json:"loaner"`
	Model  *apiHangarModel `json:"model"`
	Paint  *apiHangarPaint `json:"paint"`
}

type apiHangarModel struct {
	Name             string      `json:"name"`
	Slug             string      `json:"slug"`
	SCIdentifier     string      `json:"scIdentifier"`
	Focus            string      `json:"focus"`
	Classification   string      `json:"classification"`
	ProductionStatus string      `json:"productionStatus"`
	PledgePrice      float64     `json:"pledgePrice"`
	Manufacturer     *apiMfr     `json:"manufacturer"`
	Metrics          *apiMetrics `json:"metrics"`
	Media            *apiMedia   `json:"media"`
}

type apiMetrics struct {
	Size      string  `json:"size"`
	SizeLabel string  `json:"sizeLabel"`
	Cargo     float64 `json:"cargo"`
	Length    float64 `json:"length"`
	Beam      float64 `json:"beam"`
	Height    float64 `json:"height"`
	Mass      float64 `json:"mass"`
}

type apiHangarPaint struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
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

	var allVehicles []models.Vehicle
	page := 1
	perPage := 30

	for {
		url := fmt.Sprintf("%s/v1/public/hangars/%s?page=%d&perPage=%d", c.baseURL, username, page, perPage)
		log.Debug().Str("url", url).Int("page", page).Msg("fetching hangar page")

		body, err := c.doGet(ctx, url)
		if err != nil {
			return allVehicles, fmt.Errorf("fetching hangar page %d: %w", page, err)
		}

		var entries []apiHangarEntry
		if err := json.Unmarshal(body, &entries); err != nil {
			return allVehicles, fmt.Errorf("parsing hangar page %d: %w", page, err)
		}

		if len(entries) == 0 {
			break
		}

		for _, e := range entries {
			if e.Model == nil {
				continue
			}

			v := models.Vehicle{
				ShipSlug:   e.Model.Slug,
				ShipName:   e.Model.Name,
				Source:     "fleetyards",
				Public:     true,
				Loaner:     e.Loaner,
			}

			if e.Model.Manufacturer != nil {
				v.ManufacturerName = e.Model.Manufacturer.Name
				v.ManufacturerCode = e.Model.Manufacturer.Code
			}

			if e.Paint != nil {
				v.PaintName = e.Paint.Name
			}

			allVehicles = append(allVehicles, v)
		}

		log.Info().Int("page", page).Int("count", len(entries)).Int("total", len(allVehicles)).Msg("fetched hangar page")

		if len(entries) < perPage {
			break
		}

		page++
		time.Sleep(500 * time.Millisecond)
	}

	log.Info().Int("count", len(allVehicles)).Str("user", username).Msg("fetched hangar")
	return allVehicles, nil
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
