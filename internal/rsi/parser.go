package rsi

import (
	"encoding/json"
	"fmt"
)

// browseResource is a single item from the RSI store GraphQL browse query.
// Used for both ships and paints — they share the same response shape.
type browseResource struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Title string `json:"title"`
	URL   string `json:"url"`
	Media struct {
		Thumbnail struct {
			StoreSmall string `json:"storeSmall"`
		} `json:"thumbnail"`
	} `json:"media"`
	NativePrice struct {
		Amount float64 `json:"amount"`
	} `json:"nativePrice"`
	IsPackage bool `json:"isPackage"`
}

// browseListing holds the listing (search results) from the browse query.
type browseListing struct {
	Resources  []browseResource `json:"resources"`
	Count      int              `json:"count"`
	TotalCount int              `json:"totalCount"`
}

// browseResponse is the data field from the RSI GraphQL browse query.
type browseResponse struct {
	Store struct {
		Listing browseListing `json:"listing"`
	} `json:"store"`
}

// ParseBrowseResponse parses the GraphQL data field into a browse response.
func ParseBrowseResponse(data json.RawMessage) (*browseResponse, error) {
	var resp browseResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("parsing browse response: %w", err)
	}
	return &resp, nil
}
