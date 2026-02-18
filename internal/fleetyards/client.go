package fleetyards

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"
)

// Client provides image-only access to the FleetYards API.
// All ship data (specs, dimensions, pricing, status) now comes from SC Wiki API.
// FleetYards is retained solely for store images.
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

// ShipImages holds the slug and image URLs for a single ship
type ShipImages struct {
	Slug           string
	ImageURL       string
	ImageURLSmall  string
	ImageURLMedium string
	ImageURLLarge  string
}

// --- Raw API response types (image fields only) ---

type apiShip struct {
	Slug  string    `json:"slug"`
	Media *apiMedia `json:"media"`
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

// FetchAllShipImages retrieves slug + store images from the FleetYards API.
func (c *Client) FetchAllShipImages(ctx context.Context) ([]ShipImages, error) {
	var allImages []ShipImages
	page := 1
	perPage := 50

	for {
		url := fmt.Sprintf("%s/v1/models?page=%d&perPage=%d", c.baseURL, page, perPage)
		log.Debug().Str("url", url).Int("page", page).Msg("fetching ship images page")

		body, err := c.doGet(ctx, url)
		if err != nil {
			return allImages, fmt.Errorf("fetching page %d: %w", page, err)
		}

		var apiShips []apiShip
		if err := json.Unmarshal(body, &apiShips); err != nil {
			return allImages, fmt.Errorf("parsing page %d: %w", page, err)
		}

		if len(apiShips) == 0 {
			break
		}

		for _, as := range apiShips {
			if as.Media == nil || as.Media.StoreImage == nil {
				continue
			}
			img := as.Media.StoreImage
			if img.Source == "" && img.Small == "" && img.Medium == "" && img.Large == "" {
				continue
			}
			allImages = append(allImages, ShipImages{
				Slug:           as.Slug,
				ImageURL:       img.Source,
				ImageURLSmall:  img.Small,
				ImageURLMedium: img.Medium,
				ImageURLLarge:  img.Large,
			})
		}

		log.Info().Int("page", page).Int("count", len(apiShips)).Int("images_total", len(allImages)).Msg("fetched ship images page")

		if len(apiShips) < perPage {
			break
		}

		page++
		time.Sleep(500 * time.Millisecond)
	}

	return allImages, nil
}

// PaintImages holds the name, slug, and image URLs for a single paint
type PaintImages struct {
	Name           string
	Slug           string
	ImageURL       string
	ImageURLSmall  string
	ImageURLMedium string
	ImageURLLarge  string
}

type apiPaint struct {
	Name  string    `json:"name"`
	Slug  string    `json:"slug"`
	Media *apiMedia `json:"media"`
}

// FetchPaintImages retrieves paint images for a specific vehicle from FleetYards.
func (c *Client) FetchPaintImages(ctx context.Context, vehicleSlug string) ([]PaintImages, error) {
	url := fmt.Sprintf("%s/v1/models/%s/paints", c.baseURL, vehicleSlug)
	log.Debug().Str("url", url).Str("vehicle", vehicleSlug).Msg("fetching paint images")

	body, err := c.doGet(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("fetching paints for %s: %w", vehicleSlug, err)
	}

	var apiPaints []apiPaint
	if err := json.Unmarshal(body, &apiPaints); err != nil {
		return nil, fmt.Errorf("parsing paints for %s: %w", vehicleSlug, err)
	}

	var paints []PaintImages
	for _, ap := range apiPaints {
		if ap.Media == nil || ap.Media.StoreImage == nil {
			continue
		}
		img := ap.Media.StoreImage
		if img.Source == "" && img.Small == "" && img.Medium == "" && img.Large == "" {
			continue
		}
		paints = append(paints, PaintImages{
			Name:           ap.Name,
			Slug:           ap.Slug,
			ImageURL:       img.Source,
			ImageURLSmall:  img.Small,
			ImageURLMedium: img.Medium,
			ImageURLLarge:  img.Large,
		})
	}

	log.Debug().Str("vehicle", vehicleSlug).Int("paints", len(paints)).Msg("fetched paint images")
	return paints, nil
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
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<10)) // 1KB for error messages
		limit := len(body)
		if limit > 200 {
			limit = 200
		}
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body[:limit]))
	}

	return io.ReadAll(io.LimitReader(resp.Body, 10<<20)) // 10MB limit
}
