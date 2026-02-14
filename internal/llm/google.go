package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
)

type GoogleClient struct {
	apiKey string
}

func NewGoogleClient(apiKey string) *GoogleClient {
	return &GoogleClient{
		apiKey: apiKey,
	}
}

func (c *GoogleClient) TestConnection(ctx context.Context) error {
	client, err := genai.NewClient(ctx, option.WithAPIKey(c.apiKey))
	if err != nil {
		return err
	}
	defer client.Close()

	// List models to verify connection
	iter := client.ListModels(ctx)
	_, err = iter.Next()
	if err != nil && err.Error() != "no more items in iterator" {
		return err
	}

	return nil
}

func (c *GoogleClient) ListModels(ctx context.Context) ([]Model, error) {
	client, err := genai.NewClient(ctx, option.WithAPIKey(c.apiKey))
	if err != nil {
		return nil, err
	}
	defer client.Close()

	var models []Model
	iter := client.ListModels(ctx)
	for {
		m, err := iter.Next()
		if err != nil {
			if err.Error() == "no more items in iterator" {
				break
			}
			return nil, err
		}

		// Filter to generative models only
		if m.Name != "" {
			models = append(models, Model{
				ID:          m.Name,
				Name:        m.DisplayName,
				Description: m.Description,
			})
		}
	}

	return models, nil
}

func (c *GoogleClient) GenerateFleetAnalysis(ctx context.Context, model string, fleetData interface{}) (string, error) {
	client, err := genai.NewClient(ctx, option.WithAPIKey(c.apiKey))
	if err != nil {
		return "", err
	}
	defer client.Close()

	// Marshal fleet data to JSON
	fleetJSON, err := json.MarshalIndent(fleetData, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal fleet data: %w", err)
	}

	// Extract model name (remove "models/" prefix if present)
	modelName := model
	if len(model) > 7 && model[:7] == "models/" {
		modelName = model[7:]
	}

	genModel := client.GenerativeModel(modelName)

	systemPrompt := `You are a Star Citizen fleet analyst. Analyze the provided fleet data and provide insights on:
1. Fleet composition strengths and weaknesses
2. Role coverage gaps (e.g., missing refueling, medical, repair capabilities)
3. Redundancies (multiple ships with similar roles)
4. Insurance status (LTI vs non-LTI)
5. Optimization suggestions (e.g., ships to add, melt, or CCU)

Provide a clear, actionable analysis without using emojis.`

	userPrompt := fmt.Sprintf("Fleet data:\n\n%s\n\nProvide a comprehensive fleet analysis.", string(fleetJSON))

	// Generate content
	resp, err := genModel.GenerateContent(ctx, genai.Text(systemPrompt+"\n\n"+userPrompt))
	if err != nil {
		return "", fmt.Errorf("google api error: %w", err)
	}

	if len(resp.Candidates) == 0 || resp.Candidates[0].Content == nil {
		return "", errors.New("no response from google")
	}

	// Extract text from response
	var result string
	for _, part := range resp.Candidates[0].Content.Parts {
		if text, ok := part.(genai.Text); ok {
			result += string(text)
		}
	}

	if result == "" {
		return "", errors.New("empty response from google")
	}

	return result, nil
}
