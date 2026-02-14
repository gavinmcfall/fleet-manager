// Package scwiki provides rate-limited access to the Star Citizen Wiki API
// with database synchronization support. It implements token bucket rate
// limiting, automatic pagination, and incremental sync with UPSERT logic.
package scwiki

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"golang.org/x/time/rate"
)

const (
	DefaultBaseURL   = "https://api.star-citizen.wiki"
	DefaultUserAgent = "Fleet-Manager/1.0"
	DefaultRateLimit = 1  // requests per second
	DefaultBurst     = 5  // allow bursts
)

// Client is a rate-limited HTTP client for the SC Wiki API
type Client struct {
	httpClient  *http.Client
	rateLimiter *rate.Limiter
	baseURL     string
	userAgent   string
}

// PaginationMeta represents pagination metadata from API responses
type PaginationMeta struct {
	CurrentPage int `json:"current_page"`
	LastPage    int `json:"last_page"`
	PerPage     int `json:"per_page"`
	Total       int `json:"total"`
}

// APIResponse is a generic response wrapper
type APIResponse struct {
	Data []json.RawMessage `json:"data"`
	Meta *PaginationMeta   `json:"meta"`
}

// NewClient creates a new rate-limited SC Wiki API client
func NewClient(rateLimit float64, burst int) *Client {
	if rateLimit <= 0 {
		rateLimit = DefaultRateLimit
	}
	if burst <= 0 {
		burst = DefaultBurst
	}

	return &Client{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		rateLimiter: rate.NewLimiter(rate.Limit(rateLimit), burst),
		baseURL:     DefaultBaseURL,
		userAgent:   DefaultUserAgent,
	}
}

// Get performs a rate-limited GET request
func (c *Client) Get(ctx context.Context, path string) ([]byte, error) {
	// Wait for rate limiter
	if err := c.rateLimiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("rate limiter: %w", err)
	}

	url := c.baseURL + path
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", c.userAgent)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// Handle rate limiting (429 Too Many Requests)
	if resp.StatusCode == http.StatusTooManyRequests {
		// Check for Retry-After header
		retryAfter := resp.Header.Get("Retry-After")
		if retryAfter != "" {
			if seconds, err := strconv.Atoi(retryAfter); err == nil {
				time.Sleep(time.Duration(seconds) * time.Second)
				// Retry once
				return c.Get(ctx, path)
			}
		}
		return nil, fmt.Errorf("rate limited (429)")
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("api error (status %d): %s", resp.StatusCode, string(body))
	}

	return body, nil
}

// GetPaginated fetches all pages from a paginated endpoint
func (c *Client) GetPaginated(ctx context.Context, path string) ([]json.RawMessage, error) {
	var allData []json.RawMessage
	page := 1

	for {
		// Add pagination parameters
		separator := "?"
		if strings.Contains(path, "?") {
			separator = "&"
		}
		pagePath := fmt.Sprintf("%s%spage[number]=%d&page[size]=100", path, separator, page)

		body, err := c.Get(ctx, pagePath)
		if err != nil {
			return nil, fmt.Errorf("page %d: %w", page, err)
		}

		var response APIResponse
		if err := json.Unmarshal(body, &response); err != nil {
			return nil, fmt.Errorf("page %d unmarshal: %w", page, err)
		}

		if len(response.Data) == 0 {
			break
		}

		allData = append(allData, response.Data...)

		// Check if we've reached the last page
		if response.Meta != nil && page >= response.Meta.LastPage {
			break
		}

		page++
	}

	return allData, nil
}
