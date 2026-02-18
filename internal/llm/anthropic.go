package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/rs/zerolog/log"
)

type AnthropicClient struct {
	apiKey string
	client *http.Client
}

func NewAnthropicClient(apiKey string) *AnthropicClient {
	return &AnthropicClient{
		apiKey: apiKey,
		client: &http.Client{
			Timeout: 3 * time.Minute, // AI analysis can take time for large fleets
		},
	}
}

func (c *AnthropicClient) TestConnection(ctx context.Context) error {
	// Test by making a minimal API call
	req := map[string]interface{}{
		"model":      "claude-3-5-haiku-20241022",
		"max_tokens": 10,
		"messages": []map[string]interface{}{
			{
				"role":    "user",
				"content": "test",
			},
		},
	}

	_, err := c.callAPI(ctx, req)
	return err
}

// ListModels returns known Anthropic models.
// NOTE: Anthropic does not provide a model listing API endpoint.
// This list must be manually updated when new models are released.
// See: https://docs.anthropic.com/en/docs/models-overview
// List accurate as of 2026-02-13
func (c *AnthropicClient) ListModels(ctx context.Context) ([]Model, error) {
	return []Model{
		{
			ID:          "claude-opus-4-6",
			Name:        "Claude Opus 4.6",
			Description: "Most capable model for complex analysis",
		},
		{
			ID:          "claude-sonnet-4-5",
			Name:        "Claude Sonnet 4.5",
			Description: "Balanced performance and cost",
		},
		{
			ID:          "claude-3-5-haiku-20241022",
			Name:        "Claude 3.5 Haiku",
			Description: "Fast and cost-effective",
		},
	}, nil
}

// loadAnalysisPrompt loads the analysis prompt from prompts/analysis.md
func loadAnalysisPrompt() string {
	// Try to load from file
	promptPath := filepath.Join("prompts", "analysis.md")
	content, err := os.ReadFile(promptPath)
	if err != nil {
		log.Warn().Err(err).Str("path", promptPath).Msg("Failed to load analysis prompt from file, using fallback")
		// Fallback to embedded prompt
		return `You are a Star Citizen fleet analyst. Analyze the provided fleet data and provide insights on:
1. Fleet composition strengths and weaknesses
2. Role coverage gaps (e.g., missing refueling, medical, repair capabilities)
3. Redundancies (multiple ships with similar roles)
4. Insurance status (LTI vs non-LTI)
5. Optimization suggestions (e.g., ships to add, melt, or CCU)

Provide a clear, actionable analysis without using emojis.`
	}

	log.Debug().Str("path", promptPath).Msg("Loaded analysis prompt from file")
	return string(content)
}

func (c *AnthropicClient) GenerateFleetAnalysis(ctx context.Context, model string, fleetData interface{}) (string, error) {
	// Marshal fleet data to JSON
	fleetJSON, err := json.MarshalIndent(fleetData, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal fleet data: %w", err)
	}

	systemPrompt := loadAnalysisPrompt()
	userPrompt := fmt.Sprintf("Fleet data:\n\n%s\n\nProvide a comprehensive fleet analysis.", string(fleetJSON))

	req := map[string]interface{}{
		"model":      model,
		"max_tokens": 4000,
		"system":     systemPrompt,
		"messages": []map[string]interface{}{
			{
				"role":    "user",
				"content": userPrompt,
			},
		},
	}

	resp, err := c.callAPI(ctx, req)
	if err != nil {
		return "", fmt.Errorf("anthropic api error: %w", err)
	}

	// Extract text from response
	content, ok := resp["content"].([]interface{})
	if !ok || len(content) == 0 {
		return "", errors.New("no response from anthropic")
	}

	firstBlock, ok := content[0].(map[string]interface{})
	if !ok {
		return "", errors.New("unexpected response format")
	}

	text, ok := firstBlock["text"].(string)
	if !ok {
		return "", errors.New("no text in response")
	}

	return text, nil
}

func (c *AnthropicClient) callAPI(ctx context.Context, reqBody map[string]interface{}) (map[string]interface{}, error) {
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1MB limit
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("api error (status %d): %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	return result, nil
}
