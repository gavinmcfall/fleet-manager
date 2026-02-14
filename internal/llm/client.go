// Package llm provides a unified client interface for LLM providers
// including OpenAI, Anthropic (Claude), and Google Gemini. It handles
// API authentication, model listing, and fleet analysis generation.
package llm

import (
	"context"
	"errors"
)

// Provider types
const (
	ProviderOpenAI    = "openai"
	ProviderAnthropic = "anthropic"
	ProviderGoogle    = "google"
)

// Model represents an available LLM model
type Model struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

// Client interface for LLM providers
type Client interface {
	TestConnection(ctx context.Context) error
	ListModels(ctx context.Context) ([]Model, error)
	GenerateFleetAnalysis(ctx context.Context, model string, fleetData interface{}) (string, error)
}

// NewClient factory function
func NewClient(provider, apiKey string) (Client, error) {
	switch provider {
	case ProviderOpenAI:
		return NewOpenAIClient(apiKey), nil
	case ProviderAnthropic:
		return NewAnthropicClient(apiKey), nil
	case ProviderGoogle:
		return NewGoogleClient(apiKey), nil
	default:
		return nil, errors.New("unsupported provider: " + provider)
	}
}
