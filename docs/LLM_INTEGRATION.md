# LLM Integration - Implementation Summary

## Overview

AI-powered fleet analysis has been successfully integrated into the Fleet Manager. Users can configure their own LLM provider (OpenAI, Anthropic, or Google) and generate AI insights about their Star Citizen fleet.

## Features Implemented

### 1. Secure API Key Storage
- **Encryption**: AES-256-GCM encryption for API key storage
- **Environment Variable**: `ENCRYPTION_KEY` (32-byte base64-encoded key)
- **Auto-generation**: Random key generated if not set (development only)
- **Masked Display**: API keys shown as `sk-...abc123` in UI

### 2. Multi-Provider Support
- **OpenAI**: GPT-4, GPT-3.5-turbo models
- **Anthropic (Claude)**: Opus 4.6, Sonnet 4.5, Haiku 3.5
- **Google (Gemini)**: Dynamic model fetching from API

### 3. Settings Page (`/settings`)
- Provider selection (radio buttons)
- API key input (password field)
- Connection testing with dynamic model fetching
- Model selection dropdown
- Configuration persistence

### 4. Analysis Integration (`/analysis`)
- "Generate AI Insights" button (only shown if LLM configured)
- AI-generated fleet analysis panel
- Professional, emoji-free output
- Markdown-style formatting

## Architecture

### Backend (`/internal/`)

#### `crypto/encryption.go`
- `InitEncryption(keyString)` - Initialize from env var
- `Encrypt(plaintext)` - AES-256-GCM encryption
- `Decrypt(ciphertext)` - AES-256-GCM decryption
- `MaskAPIKey(apiKey)` - Display masking

#### `llm/client.go`
- Unified `Client` interface for all providers
- Factory function `NewClient(provider, apiKey)`
- Model listing and analysis generation

#### `llm/openai.go`
- Uses `github.com/sashabaranov/go-openai` SDK
- Dynamic model fetching via `ListModels()`
- Chat completions with system prompt

#### `llm/anthropic.go`
- Direct HTTP calls to Anthropic API
- Hardcoded model list (no list endpoint)
- Messages API with system prompt

#### `llm/google.go`
- Uses `github.com/google/generative-ai-go` SDK
- Dynamic model fetching
- Content generation with system prompt

#### API Endpoints (`api/router.go`)
- `GET /api/settings/llm-config` - Get LLM configuration
- `PUT /api/settings/llm-config` - Save LLM configuration
- `POST /api/llm/test-connection` - Test API key and fetch models
- `POST /api/llm/generate-analysis` - Generate AI insights

### Frontend (`/frontend/src/`)

#### `pages/Settings.jsx`
- Provider selection UI
- API key input and testing
- Model selection
- Save configuration

#### `pages/Analysis.jsx`
- AI insights button (conditional on LLM config)
- AI insights panel
- State management for generation

#### `hooks/useAPI.js`
- `useLLMConfig()` - Hook for LLM configuration
- `setLLMConfig(config)` - Save configuration
- `testLLMConnection(provider, apiKey)` - Test connection
- `generateAIAnalysis()` - Generate AI insights

## Environment Variables

```bash
# Required for production - generate with: openssl rand -base64 32
ENCRYPTION_KEY=your-base64-encoded-32-byte-key

# Existing variables
PORT=8080
DB_DRIVER=sqlite
DB_PATH=./data/fleet-manager.db
FLEETYARDS_USER=
SYNC_SCHEDULE="0 3 * * *"
STATIC_DIR=./frontend/dist
```

## Dependencies Added

### Go Modules
```bash
github.com/sashabaranov/go-openai v1.41.2
github.com/anthropics/anthropic-sdk-go v1.22.1
github.com/google/generative-ai-go v0.20.1
```

### NPM Packages
No new packages required (Lucide React icons already present)

## Testing Instructions

### 1. Generate Encryption Key
```bash
export ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> .env
```

### 2. Build and Run
```bash
# Frontend
cd frontend && npm install && npm run build && cd ..

# Backend
go mod tidy
CGO_ENABLED=1 go build -o fleet-manager ./cmd/server
./fleet-manager
```

### 3. Configure LLM Provider

#### OpenAI
1. Navigate to `/settings`
2. Select "OpenAI (ChatGPT)"
3. Enter API key from https://platform.openai.com/api-keys
4. Click "Test Connection"
5. Verify models load (gpt-4, gpt-3.5-turbo, etc.)
6. Select preferred model
7. Click "Save Configuration"

#### Anthropic
1. Select "Anthropic (Claude)"
2. Enter API key from https://console.anthropic.com/
3. Test connection
4. Available models: Claude Opus 4.6, Sonnet 4.5, Haiku 3.5
5. Save configuration

#### Google Gemini
1. Select "Google (Gemini)"
2. Enter API key from https://aistudio.google.com/apikey
3. Test connection (fetches available models)
4. Select model
5. Save configuration

### 4. Generate AI Insights
1. Navigate to `/analysis`
2. Verify "Generate AI Insights" button appears (top right)
3. Click button
4. Wait for AI-generated analysis to appear
5. Review insights (no emojis, professional formatting)

## Security Notes

### API Key Protection
- Keys encrypted with AES-256-GCM before storage
- Keys never appear in logs or responses (only masked)
- Keys stored in SQLite database (local to self-hosted instance)

### Encryption Key Rotation
- If `ENCRYPTION_KEY` changes, existing encrypted keys become unrecoverable
- Users must re-enter API keys after rotation
- **Production deployments should set ENCRYPTION_KEY and never change it**

### HTTPS Recommendation
- For production deployments, use HTTPS to protect API keys in transit
- Self-signed certificates acceptable for home use
- Let's Encrypt recommended for public deployments

## Known Limitations

1. **No streaming responses**: AI generation waits for full response
2. **No chat history**: Each analysis is independent
3. **No prompt customization**: System prompt is hardcoded
4. **Google model names**: Some models have `models/` prefix
5. **Anthropic model list**: Hardcoded (no list endpoint in API)

## Future Enhancements

### Phase 2 (Not Implemented)
1. **Chat interface**: Interactive Q&A about fleet
2. **Streaming responses**: Real-time AI output
3. **Prompt templates**: User-customizable analysis prompts
4. **Analysis history**: Save and review past insights
5. **Melt/CCU suggestions**: AI-driven ship upgrade recommendations
6. **Org fleet comparison**: Compare personal fleet to org needs
7. **Build loadout recommendations**: AI-suggested component loadouts

### Phase 3 (Future)
1. **Multi-model comparison**: Run analysis with multiple models
2. **Custom system prompts**: User-defined analysis focus
3. **Export insights**: Save analysis as PDF/Markdown
4. **Scheduled analysis**: Auto-generate weekly fleet reports
5. **Voice input**: Ask questions via speech

## Troubleshooting

### "ENCRYPTION_KEY not set" warning
- Expected in development mode
- Set `ENCRYPTION_KEY` environment variable for production
- Generate with: `openssl rand -base64 32`

### "API key is invalid" error
- Verify API key is correct for the selected provider
- Check API key permissions (some keys have restricted scopes)
- Ensure API key has not expired

### "Failed to fetch models" error
- Check internet connectivity
- Verify API key has model access
- For Google: Some API keys may have regional restrictions

### "AI analysis failed" error
- Check API quota/billing
- Verify model selected is still available
- Check API status pages:
  - OpenAI: https://status.openai.com/
  - Anthropic: https://status.anthropic.com/
  - Google: https://status.cloud.google.com/

### Database errors after key rotation
- Expected behavior - encrypted data is unrecoverable
- Re-enter API key in Settings page
- Data is re-encrypted with new key

## Implementation Checklist

- ✅ Encryption infrastructure (AES-256-GCM)
- ✅ LLM client interface (multi-provider)
- ✅ OpenAI integration
- ✅ Anthropic integration (HTTP-based)
- ✅ Google Gemini integration
- ✅ Backend API endpoints
- ✅ Settings page UI
- ✅ Analysis page integration
- ✅ API key masking
- ✅ Connection testing
- ✅ Dynamic model fetching
- ✅ Frontend build successful
- ✅ Backend build successful
- ✅ No emojis in UI

## File Changes

### New Files
- `internal/crypto/encryption.go` (149 lines)
- `internal/llm/client.go` (40 lines)
- `internal/llm/openai.go` (78 lines)
- `internal/llm/anthropic.go` (154 lines)
- `internal/llm/google.go` (112 lines)
- `frontend/src/pages/Settings.jsx` (238 lines)
- `docs/LLM_INTEGRATION.md` (this file)

### Modified Files
- `cmd/server/main.go` - Added encryption initialization
- `internal/api/router.go` - Added LLM routes and handlers
- `frontend/src/hooks/useAPI.js` - Added LLM API hooks
- `frontend/src/App.jsx` - Added Settings route and nav
- `frontend/src/pages/Analysis.jsx` - Added AI insights button/panel
- `go.mod` - Added LLM SDK dependencies
- `go.sum` - Updated checksums

## Success Criteria

- ✅ Users can select LLM provider (OpenAI, Anthropic, Google)
- ✅ API keys encrypted with AES-256-GCM before storage
- ✅ Test connection validates API key and fetches models
- ✅ Models dynamically populated based on user's account
- ✅ Settings persist across app restarts
- ✅ "Generate AI Insights" button appears on Analysis page
- ✅ Clicking button generates AI-powered fleet analysis
- ✅ No emojis in UI (professional design)
- ✅ Frontend builds without errors
- ✅ Backend builds without errors

## Deployment Notes

### Docker/Kubernetes
- Set `ENCRYPTION_KEY` as secret/env var
- Persist SQLite database volume (contains encrypted keys)
- Expose port 8080 (or configure via `PORT` env var)

### BJW-S App-Template
- Add `ENCRYPTION_KEY` to `env` section
- Set `persistence.enabled: true` for database
- Configure ingress for HTTPS (recommended)

### Example Helm Values
```yaml
env:
  ENCRYPTION_KEY: "base64-encoded-32-byte-key"
  DB_DRIVER: sqlite
  DB_PATH: /data/fleet-manager.db

persistence:
  data:
    enabled: true
    mountPath: /data
```

---

**Implementation Complete** - Ready for testing and deployment!
