# SC Wiki API Model Validation

## Overview

The SC Wiki API schema can change over time, causing field type mismatches with our Go models. This document explains how to validate and update models when the API changes.

## Validation Test

Run the model validation test to check for schema mismatches:

```bash
cd internal/scwiki
go test -v -run TestModelValidation
```

This test fetches live data from the API and attempts to unmarshal it into our Go models. Any unmarshal errors indicate field type mismatches.

## OpenAPI Specification

The SC Wiki API provides an OpenAPI specification that documents all endpoints and data structures.

**Location:** `docs/sc-wiki-openapi.yaml`

### Key Schemas

- **`game_vehicle`** - Vehicle data (line ~8813)
- **`manufacturer_link`** - Manufacturer reference
- **`game_item`** - Item/component data
- **`game_port`** - Ship hardpoint/port data

### Using the OpenAPI Spec

#### 1. View Schema in Browser

```bash
# Install openapi-ui (one-time)
npm install -g @stoplight/http-server

# Serve the spec
cd docs
http-server . -p 8081
```

Open: `http://localhost:8081/sc-wiki-openapi.yaml` in browser with OpenAPI viewer extension

#### 2. Generate Go Types (Future)

We could use `oapi-codegen` to auto-generate Go types from the spec:

```bash
go install github.com/deepmap/oapi-codegen/cmd/oapi-codegen@latest
oapi-codegen -package scwiki -generate types docs/sc-wiki-openapi.yaml > internal/scwiki/openapi_types.go
```

**Note:** Currently not used because the API schema includes many optional/nullable fields that would require extensive pointer handling.

## Known Schema Changes

### 2026-02-14: Vehicle `size` Field

**Change:** `size` field changed from `integer` to localized object

**Before:**
```json
{
  "size": 2
}
```

**After:**
```json
{
  "size": {
    "de_DE": "Klein",
    "en_EN": "small",
    "zh_CN": "小"
  }
}
```

**Fix:** Changed Go model to ignore the field:
```go
type Vehicle struct {
    Size int `json:"-"` // Ignored - API now returns localized object
    // Full raw data stored in RawData field
}
```

## Debugging Schema Mismatches

### 1. Enable Verbose Logging

In `internal/scwiki/sync.go`, unmarshal warnings log the full raw JSON:

```go
log.Warn().
    Err(err).
    Int("record_index", i).
    RawJSON("raw_data", raw).
    Msg("failed to unmarshal vehicle")
```

### 2. Extract Problematic Field

From logs:
```bash
grep "failed to unmarshal" /tmp/fleet-manager.log | head -1 | jq '.raw_data.size'
```

### 3. Check OpenAPI Spec

Search the spec for the field:
```bash
grep -A 10 "size:" docs/sc-wiki-openapi.yaml
```

### 4. Update Go Model

Options:
- **Ignore field:** Use `json:"-"` if not needed
- **Make flexible:** Use `interface{}` or `json.RawMessage`
- **Custom unmarshaler:** Implement `UnmarshalJSON()` for complex types
- **Extract from RawData:** Access via `vehicle.RawData["size"]` when needed

## Best Practices

1. **Always store RawData** - Capture full API response in `RawData map[string]interface{}`
2. **Graceful degradation** - Don't fail sync if non-critical fields change
3. **Log warnings, not errors** - Unmarshal failures for individual records should warn, not abort
4. **Filter post-unmarshal** - Type filtering (like `isRelevantItemType`) happens AFTER unmarshal succeeds
5. **Test with live data** - Run `TestModelValidation` against the real API periodically

## Updating the OpenAPI Spec

Download latest spec:
```bash
curl https://api.star-citizen.wiki/api/documentation > docs/sc-wiki-openapi.yaml
```

Re-run validation tests after updating.

## Reference

- **SC Wiki API Docs:** https://api.star-citizen.wiki/api/documentation
- **OpenAPI Spec:** https://api.star-citizen.wiki/api/documentation (JSON format)
- **Model Tests:** `internal/scwiki/models_test.go`
