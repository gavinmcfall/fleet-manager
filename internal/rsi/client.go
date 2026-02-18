package rsi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"golang.org/x/time/rate"
)

const (
	defaultBaseURL   = "https://robertsspaceindustries.com"
	defaultRateLimit = 1.0
	maxRetries       = 3
	userAgent        = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
	graphQLPath      = "/graphql"
)

// Client is an HTTP client for the RSI website GraphQL API.
// All store browse queries (ships, paints) work without authentication.
type Client struct {
	baseURL     string
	httpClient  *http.Client
	rateLimiter *rate.Limiter
}

// NewClient creates a new RSI API client.
func NewClient(rateLimit float64, baseURL string) *Client {
	if rateLimit <= 0 {
		rateLimit = defaultRateLimit
	}
	if baseURL == "" {
		baseURL = defaultBaseURL
	}

	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		rateLimiter: rate.NewLimiter(rate.Limit(rateLimit), 1),
	}
}

// graphQLRequest is a single operation in a batched GraphQL request.
type graphQLRequest struct {
	Query     string `json:"query"`
	Variables any    `json:"variables,omitempty"`
}

// graphQLResponse is a single response in a batched GraphQL response.
type graphQLResponse struct {
	Data   json.RawMessage `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

// QueryGraphQL sends a GraphQL query to RSI and returns the data field.
// RSI's GraphQL endpoint accepts batched requests (JSON array), so we wrap
// the single query in an array and unwrap the single response.
func (c *Client) QueryGraphQL(ctx context.Context, query string, variables any) (json.RawMessage, error) {
	return c.queryWithRetry(ctx, query, variables, 0)
}

func (c *Client) queryWithRetry(ctx context.Context, query string, variables any, attempt int) (json.RawMessage, error) {
	if err := c.rateLimiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("rate limiter: %w", err)
	}

	// RSI expects a batched request (JSON array of operations)
	batch := []graphQLRequest{{Query: query, Variables: variables}}
	bodyJSON, err := json.Marshal(batch)
	if err != nil {
		return nil, fmt.Errorf("marshalling GraphQL request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+graphQLPath, bytes.NewReader(bodyJSON))
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20)) // 10MB limit
	if err != nil {
		return nil, err
	}

	// Handle rate limiting (429)
	if resp.StatusCode == http.StatusTooManyRequests {
		if attempt >= maxRetries {
			return nil, fmt.Errorf("rate limited (429) after %d retries", maxRetries)
		}
		wait := 5 * time.Second
		if retryAfter := resp.Header.Get("Retry-After"); retryAfter != "" {
			if seconds, err := strconv.Atoi(retryAfter); err == nil {
				wait = time.Duration(seconds) * time.Second
			}
		}
		select {
		case <-time.After(wait):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
		return c.queryWithRetry(ctx, query, variables, attempt+1)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("RSI GraphQL error (HTTP %d): %s", resp.StatusCode, truncate(string(body), 200))
	}

	// Parse batched response (array of responses)
	var responses []graphQLResponse
	if err := json.Unmarshal(body, &responses); err != nil {
		return nil, fmt.Errorf("parsing GraphQL response: %w", err)
	}

	if len(responses) == 0 {
		return nil, fmt.Errorf("empty GraphQL response")
	}

	if len(responses[0].Errors) > 0 {
		return nil, fmt.Errorf("GraphQL error: %s", responses[0].Errors[0].Message)
	}

	return responses[0].Data, nil
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
