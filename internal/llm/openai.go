package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/sashabaranov/go-openai"
)

type OpenAIClient struct {
	client *openai.Client
}

func NewOpenAIClient(apiKey string) *OpenAIClient {
	return &OpenAIClient{
		client: openai.NewClient(apiKey),
	}
}

func (c *OpenAIClient) TestConnection(ctx context.Context) error {
	_, err := c.client.ListModels(ctx)
	return err
}

func (c *OpenAIClient) ListModels(ctx context.Context) ([]Model, error) {
	resp, err := c.client.ListModels(ctx)
	if err != nil {
		return nil, err
	}

	var models []Model
	for _, m := range resp.Models {
		// Filter to chat models only (gpt-4, gpt-3.5-turbo, etc.)
		if strings.HasPrefix(m.ID, "gpt-") && !strings.Contains(m.ID, "instruct") {
			models = append(models, Model{
				ID:   m.ID,
				Name: m.ID,
			})
		}
	}
	return models, nil
}

func (c *OpenAIClient) GenerateFleetAnalysis(ctx context.Context, model string, fleetData interface{}) (string, error) {
	// Marshal fleet data to JSON
	fleetJSON, err := json.MarshalIndent(fleetData, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal fleet data: %w", err)
	}

	// Create system prompt
	systemPrompt := `You are a Star Citizen fleet analyst. Analyze the provided fleet data and provide insights on:
1. Fleet composition strengths and weaknesses
2. Role coverage gaps (e.g., missing refueling, medical, repair capabilities)
3. Redundancies (multiple ships with similar roles)
4. Insurance status (LTI vs non-LTI)
5. Optimization suggestions (e.g., ships to add, melt, or CCU)

Provide a clear, actionable analysis without using emojis.`

	userPrompt := fmt.Sprintf("Fleet data:\n\n%s\n\nProvide a comprehensive fleet analysis.", string(fleetJSON))

	// Create chat completion
	resp, err := c.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model: model,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: systemPrompt,
			},
			{
				Role:    openai.ChatMessageRoleUser,
				Content: userPrompt,
			},
		},
		Temperature: 0.7,
		MaxTokens:   2000,
	})

	if err != nil {
		return "", fmt.Errorf("openai api error: %w", err)
	}

	if len(resp.Choices) == 0 {
		return "", errors.New("no response from openai")
	}

	return resp.Choices[0].Message.Content, nil
}
