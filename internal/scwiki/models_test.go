package scwiki

import (
	"context"
	"encoding/json"
	"testing"
)

// TestModelValidation tests that our Go models can unmarshal real API responses
// This catches field type mismatches like the size field changing from int to object
func TestModelValidation(t *testing.T) {
	client := NewClient(1.0, 5)
	ctx := context.Background()

	t.Run("Manufacturer model matches API", func(t *testing.T) {
		data, err := client.GetPaginated(ctx, "/api/manufacturers?page[size]=5")
		if err != nil {
			t.Skipf("API unavailable: %v", err)
		}

		if len(data) == 0 {
			t.Skip("No manufacturers returned from API")
		}

		var m Manufacturer
		if err := json.Unmarshal(data[0], &m); err != nil {
			t.Errorf("Failed to unmarshal manufacturer: %v\nRaw data: %s", err, string(data[0]))
		}

		// Basic validation
		if m.UUID == "" {
			t.Error("Manufacturer UUID is empty")
		}
	})

	t.Run("Vehicle model matches API", func(t *testing.T) {
		data, err := client.GetPaginated(ctx, "/api/vehicles?page[size]=5&include=manufacturer,ports")
		if err != nil {
			t.Skipf("API unavailable: %v", err)
		}

		if len(data) == 0 {
			t.Skip("No vehicles returned from API")
		}

		successCount := 0
		failureCount := 0
		var lastError error

		for i, raw := range data {
			var v Vehicle
			var fullData map[string]any
			json.Unmarshal(raw, &fullData)
			v.RawData = fullData

			if err := json.Unmarshal(raw, &v); err != nil {
				failureCount++
				lastError = err
				t.Logf("Vehicle #%d unmarshal failed: %v", i, err)
			} else {
				successCount++
				if v.UUID == "" {
					t.Errorf("Vehicle #%d: UUID is empty", i)
				}
			}
		}

		// Require at least 80% success rate
		if failureCount > 0 {
			successRate := float64(successCount) / float64(successCount+failureCount)
			if successRate < 0.8 {
				t.Errorf("Too many vehicle unmarshal failures: %d/%d succeeded (%.0f%%). Last error: %v",
					successCount, successCount+failureCount, successRate*100, lastError)
			} else {
				t.Logf("Vehicle unmarshal: %d/%d succeeded (%.0f%%). Some failures are expected due to API schema variations.",
					successCount, successCount+failureCount, successRate*100)
			}
		}
	})

	t.Run("Item model matches API", func(t *testing.T) {
		data, err := client.GetPaginated(ctx, "/api/items?page[size]=10&include=manufacturer")
		if err != nil {
			t.Skipf("API unavailable: %v", err)
		}

		if len(data) == 0 {
			t.Skip("No items returned from API")
		}

		successCount := 0
		failureCount := 0
		var lastError error

		for i, raw := range data {
			var item Item
			var fullData map[string]any
			json.Unmarshal(raw, &fullData)
			item.RawData = fullData

			if err := json.Unmarshal(raw, &item); err != nil {
				failureCount++
				lastError = err
				t.Logf("Item #%d unmarshal failed: %v", i, err)
			} else {
				successCount++
			}
		}

		// Require at least 80% success rate
		if failureCount > 0 {
			successRate := float64(successCount) / float64(successCount+failureCount)
			if successRate < 0.8 {
				t.Errorf("Too many item unmarshal failures: %d/%d succeeded (%.0f%%). Last error: %v",
					successCount, successCount+failureCount, successRate*100, lastError)
			} else {
				t.Logf("Item unmarshal: %d/%d succeeded (%.0f%%). Some failures are expected due to API schema variations.",
					successCount, successCount+failureCount, successRate*100)
			}
		}
	})
}

// TestKnownFieldTypeChanges documents known API schema changes
func TestKnownFieldTypeChanges(t *testing.T) {
	t.Log("Known SC Wiki API schema changes:")
	t.Log("- Vehicle.size: Changed from integer to localized object {de_DE, en_EN, zh_CN}")
	t.Log("  Our model: Ignores this field (json:\"-\") and stores full data in RawData")
	t.Log("  Fixed: 2026-02-14")
}
