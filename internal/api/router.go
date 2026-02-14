package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/nzvengeance/fleet-manager/internal/analysis"
	"github.com/nzvengeance/fleet-manager/internal/config"
	"github.com/nzvengeance/fleet-manager/internal/crypto"
	"github.com/nzvengeance/fleet-manager/internal/database"
	"github.com/nzvengeance/fleet-manager/internal/llm"
	"github.com/nzvengeance/fleet-manager/internal/models"
	syncsvc "github.com/nzvengeance/fleet-manager/internal/sync"
	"github.com/rs/zerolog/log"
	"golang.org/x/time/rate"
)

type Server struct {
	db             *database.DB
	cfg            *config.Config
	scheduler      *syncsvc.Scheduler
	llmRateLimiter *rate.Limiter
}

func NewServer(db *database.DB, cfg *config.Config, scheduler *syncsvc.Scheduler) *Server {
	return &Server{
		db:             db,
		cfg:            cfg,
		scheduler:      scheduler,
		llmRateLimiter: rate.NewLimiter(rate.Every(10*time.Second), 1), // 1 request per 10 seconds
	}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(5 * time.Minute)) // Increased for LLM AI analysis operations
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// API routes
	r.Route("/api", func(r chi.Router) {
		r.Get("/health", s.healthCheck)
		r.Get("/status", s.getStatus)

		// Ships database
		r.Route("/ships", func(r chi.Router) {
			r.Get("/", s.listShips)
			r.Get("/{slug}", s.getShip)
		})

		// User's hangar / vehicles
		r.Route("/vehicles", func(r chi.Router) {
			r.Get("/", s.listVehicles)
			r.Get("/with-insurance", s.listVehiclesWithInsurance)
		})

		// HangarXplor import
		r.Route("/import", func(r chi.Router) {
			r.Post("/hangarxplor", s.importHangarXplor)
			r.Get("/hangarxplor", s.getHangarImports)
			r.Delete("/hangarxplor", s.clearHangarImports)
		})

		// Settings
		r.Route("/settings", func(r chi.Router) {
			r.Get("/fleetyards-user", s.getFleetYardsUserSetting)
			r.Put("/fleetyards-user", s.setFleetYardsUserSetting)

			// LLM configuration
			r.Get("/llm-config", s.getLLMConfig)
			r.Put("/llm-config", s.setLLMConfig)
		})

		// LLM operations
		r.Route("/llm", func(r chi.Router) {
			// Rate limit only expensive API calls, not local DB reads
			r.With(s.rateLimitLLM).Post("/test-connection", s.testLLMConnection)
			r.With(s.rateLimitLLM).Post("/generate-analysis", s.generateAIAnalysis)

			// No rate limit on local DB reads/deletes
			r.Get("/latest-analysis", s.getLatestAIAnalysis)
			r.Get("/analysis-history", s.getAIAnalysisHistory)
			r.Delete("/analysis/{id}", s.deleteAIAnalysis)
		})

		// Fleet analysis
		r.Get("/analysis", s.getAnalysis)

		// Sync management
		r.Route("/sync", func(r chi.Router) {
			r.Get("/status", s.getSyncStatus)
			r.Get("/sc-wiki-status", s.getSCWikiSyncStatus)
			r.Post("/ships", s.triggerShipSync)
			r.Post("/hangar", s.triggerHangarSync)
			r.Post("/enrich", s.triggerEnrich)
			r.Post("/scwiki", s.triggerSCWikiSync)
		})

		// Debug
		r.Get("/debug/imports", s.debugImports)
	})

	// Serve frontend SPA
	s.serveFrontend(r)

	return r
}

// --- Middleware ---

// rateLimitLLM rate limits LLM API calls to prevent cost explosion
func (s *Server) rateLimitLLM(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.llmRateLimiter.Allow() {
			writeError(w, http.StatusTooManyRequests, "Rate limit exceeded - please wait before making another LLM request")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Health & Status ---

func (s *Server) healthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// getFleetYardsUser returns the effective FleetYards username (DB setting first, env var fallback)
func (s *Server) getFleetYardsUser(ctx context.Context) string {
	if dbUser, _ := s.db.GetSetting(ctx, "fleetyards_user"); dbUser != "" {
		return dbUser
	}
	return s.cfg.FleetYardsUser
}

func (s *Server) getStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	shipCount, _ := s.db.GetShipCount(ctx)
	vehicleCount, _ := s.db.GetVehicleCount(ctx)
	syncStatus, _ := s.db.GetLatestSyncStatus(ctx)
	hangarSource, _ := s.db.GetSetting(ctx, "hangar_source")
	fleetYardsUser := s.getFleetYardsUser(ctx)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ships":         shipCount,
		"vehicles":      vehicleCount,
		"hangar_source": hangarSource,
		"sync_status":   syncStatus,
		"config": map[string]interface{}{
			"fleetyards_user": fleetYardsUser,
			"sync_schedule":   s.cfg.SyncSchedule,
			"db_driver":       s.cfg.DBDriver,
		},
	})
}

// --- Ships ---

func (s *Server) listShips(w http.ResponseWriter, r *http.Request) {
	ships, err := s.db.GetAllShips(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch ships: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, ships)
}

func (s *Server) getShip(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	ship, err := s.db.GetShipBySlug(r.Context(), slug)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if ship == nil {
		writeError(w, http.StatusNotFound, "Ship not found")
		return
	}
	writeJSON(w, http.StatusOK, ship)
}

// --- Vehicles ---

func (s *Server) listVehicles(w http.ResponseWriter, r *http.Request) {
	vehicles, err := s.db.GetAllVehicles(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, vehicles)
}

func (s *Server) listVehiclesWithInsurance(w http.ResponseWriter, r *http.Request) {
	vehicles, err := s.db.GetVehiclesWithInsurance(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, vehicles)
}

// --- HangarXplor Import ---

func (s *Server) importHangarXplor(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 10<<20)) // 10MB limit
	if err != nil {
		writeError(w, http.StatusBadRequest, "Failed to read body")
		return
	}

	var entries []models.HangarXplorEntry
	if err := json.Unmarshal(body, &entries); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON: "+err.Error())
		return
	}

	ctx := r.Context()

	// Clean slate — clear all existing vehicles and imports
	if err := s.db.ClearAllVehicles(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to clear vehicles: "+err.Error())
		return
	}
	if err := s.db.ClearHangarImports(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to clear old imports: "+err.Error())
		return
	}

	imported := 0
	for _, entry := range entries {
		// The "name" field is always the real variant/pledge name (e.g. "Carrack Expedition with Pisces Expedition")
		// The "ship_name" field is the base model name OR a user custom name (e.g. "Jean-Luc")
		displayName := entry.Name

		// Generate slug candidates to try matching against ships DB
		codeSlug := slugFromShipCode(entry.ShipCode) // e.g. "hull-d", "idris-p"
		nameSlug := slugFromName(displayName)         // e.g. "hull-d", "atls"
		lookupSlug := ""
		if entry.Lookup != "" {
			lookupSlug = slugFromName(entry.Lookup) // for unidentified ships
		}
		// Compact versions strip all non-alphanumeric (handles "a-t-l-s" -> "atls")
		compactCode := compactSlug(codeSlug)
		compactName := compactSlug(nameSlug)

		// Try to find a match in the ships reference table
		candidates := []string{codeSlug, nameSlug, lookupSlug, compactCode, compactName}
		matchedSlug := s.db.FindShipSlug(ctx, candidates, displayName)
		if matchedSlug == "" {
			// No match found — use best-effort slug from code
			matchedSlug = codeSlug
		}

		// Detect custom name: if ship_name is present and doesn't look like
		// part of the model name, it's a user-assigned custom name
		customName := ""
		if entry.ShipName != "" {
			// Check if ship_name is a custom name (not related to the ship code or display name)
			snLower := toLower(entry.ShipName)
			codeLower := toLower(entry.ShipCode)
			nameLower := toLower(displayName)
			isCustom := true
			// If ship_name appears in the code or display name, it's the model name
			if containsStr(codeLower, toLower(slugFromName(entry.ShipName))) {
				isCustom = false
			}
			if containsStr(nameLower, snLower) || containsStr(snLower, nameLower) {
				isCustom = false
			}
			if isCustom {
				customName = entry.ShipName
			}
		}

		// Create vehicle entry
		v := &models.Vehicle{
			ShipSlug:         matchedSlug,
			ShipName:         displayName,
			CustomName:       customName,
			ManufacturerName: entry.ManufacturerName,
			ManufacturerCode: entry.ManufacturerCode,
			Source:           "hangarxplor",
		}
		vehicleID, err := s.db.InsertVehicle(ctx, v)
		if err != nil {
			log.Warn().Err(err).Str("ship", displayName).Msg("failed to insert vehicle")
			continue
		}

		// Create import detail with pledge/insurance info
		h := &models.HangarImportDetail{
			VehicleID:  vehicleID,
			ShipSlug:   matchedSlug,
			ShipCode:   entry.ShipCode,
			LTI:        entry.LTI,
			Warbond:    entry.Warbond,
			PledgeID:   entry.PledgeID,
			PledgeName: entry.PledgeName,
			PledgeDate: entry.PledgeDate,
			PledgeCost: entry.PledgeCost,
			EntityType: entry.EntityType,
		}

		if err := s.db.UpsertHangarImport(ctx, h); err != nil {
			log.Warn().Err(err).Str("ship", displayName).Int("vehicle_id", vehicleID).Msg("failed to import hangar entry")
			continue
		}

		log.Info().
			Str("ship", displayName).
			Str("slug", matchedSlug).
			Int("vehicle_id", vehicleID).
			Bool("lti", entry.LTI).
			Str("pledge_id", entry.PledgeID).
			Msg("imported entry")
		imported++
	}

	log.Info().Int("imported", imported).Int("total", len(entries)).Msg("hangarxplor import complete")

	// Persist active source
	s.db.SetSetting(ctx, "hangar_source", "hangarxplor")

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"imported": imported,
		"total":    len(entries),
		"message":  "Import complete",
	})
}

func (s *Server) getHangarImports(w http.ResponseWriter, r *http.Request) {
	imports, err := s.db.GetHangarImports(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, imports)
}

func (s *Server) clearHangarImports(w http.ResponseWriter, r *http.Request) {
	if err := s.db.ClearHangarImports(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Imports cleared"})
}

// --- Analysis ---

func (s *Server) getAnalysis(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	vehicles, err := s.db.GetVehiclesWithInsurance(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	ships, err := s.db.GetAllShips(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	result := analysis.AnalyzeFleet(vehicles, ships)
	writeJSON(w, http.StatusOK, result)
}

// --- Sync ---

func (s *Server) getSyncStatus(w http.ResponseWriter, r *http.Request) {
	statuses, err := s.db.GetLatestSyncStatus(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, statuses)
}

func (s *Server) triggerShipSync(w http.ResponseWriter, r *http.Request) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()
		if err := s.scheduler.SyncShips(ctx); err != nil {
			log.Error().Err(err).Msg("manual ship sync failed")
		}
	}()

	writeJSON(w, http.StatusAccepted, map[string]string{
		"message": "Ship sync started",
	})
}

func (s *Server) triggerHangarSync(w http.ResponseWriter, r *http.Request) {
	fleetYardsUser := s.getFleetYardsUser(r.Context())
	if fleetYardsUser == "" {
		writeError(w, http.StatusBadRequest, "FleetYards username not configured — set it on the Import page")
		return
	}

	// Set source immediately so UI reflects the choice
	s.db.SetSetting(r.Context(), "hangar_source", "fleetyards")

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		if err := s.scheduler.SyncHangarForUser(ctx, fleetYardsUser); err != nil {
			log.Error().Err(err).Msg("manual hangar sync failed")
		}
	}()

	writeJSON(w, http.StatusAccepted, map[string]string{
		"message": "Hangar sync started",
	})
}

func (s *Server) triggerSCWikiSync(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.SCWikiEnabled {
		writeError(w, http.StatusBadRequest, "SC Wiki sync not enabled")
		return
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()
		if err := s.scheduler.SyncSCWiki(ctx); err != nil {
			log.Error().Err(err).Msg("manual SC Wiki sync failed")
		}
	}()

	writeJSON(w, http.StatusAccepted, map[string]string{
		"message": "SC Wiki sync started",
	})
}

func (s *Server) getSCWikiSyncStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	rows, err := s.db.RawConn().QueryContext(ctx, `
		SELECT endpoint, last_sync_at, total_records, sync_status, error_message
		FROM sc_sync_metadata
		ORDER BY endpoint
	`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Database query failed")
		return
	}
	defer rows.Close()

	type SyncStatus struct {
		Endpoint     string  `json:"endpoint"`
		LastSyncAt   *string `json:"last_sync_at"`
		TotalRecords int     `json:"total_records"`
		Status       string  `json:"status"`
		ErrorMessage string  `json:"error_message"`
	}

	var statuses []SyncStatus
	for rows.Next() {
		var s SyncStatus
		var lastSyncAt sql.NullTime
		if err := rows.Scan(&s.Endpoint, &lastSyncAt, &s.TotalRecords, &s.Status, &s.ErrorMessage); err != nil {
			log.Warn().Err(err).Msg("scan sync status failed")
			continue
		}
		if lastSyncAt.Valid {
			formatted := lastSyncAt.Time.Format(time.RFC3339)
			s.LastSyncAt = &formatted
		}
		statuses = append(statuses, s)
	}

	writeJSON(w, http.StatusOK, statuses)
}

// --- Settings ---

func (s *Server) getFleetYardsUserSetting(w http.ResponseWriter, r *http.Request) {
	user := s.getFleetYardsUser(r.Context())
	writeJSON(w, http.StatusOK, map[string]string{"fleetyards_user": user})
}

func (s *Server) setFleetYardsUserSetting(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	if err := s.db.SetSetting(r.Context(), "fleetyards_user", req.Username); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to save setting")
		return
	}
	log.Info().Str("username", req.Username).Msg("fleetyards username updated")
	writeJSON(w, http.StatusOK, map[string]string{"fleetyards_user": req.Username})
}

// --- Enrich ---

func (s *Server) triggerEnrich(w http.ResponseWriter, r *http.Request) {
	fleetYardsUser := s.getFleetYardsUser(r.Context())
	if fleetYardsUser == "" {
		writeError(w, http.StatusBadRequest, "FleetYards username not configured — set it on the Import page")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Minute)
	defer cancel()

	stats, err := s.enrichFromFleetYards(ctx, fleetYardsUser)
	if err != nil {
		log.Error().Err(err).Msg("enrichment failed")
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Enrichment failed: %v", err))
		return
	}

	writeJSON(w, http.StatusOK, stats)
}

type EnrichmentStats struct {
	Total          int      `json:"total"`
	Enriched       int      `json:"enriched"`
	Skipped        int      `json:"skipped"`
	Failed         int      `json:"failed"`
	LoanersAdded   int      `json:"loaners_added"`
	PaintsAdded    int      `json:"paints_added"`
	SlugsImproved  int      `json:"slugs_improved"`
	FailedSlugs    []string `json:"failed_slugs,omitempty"`
}

// enrichFromFleetYards fetches the FleetYards public hangar and updates
// existing vehicles with supplementary data (loaner, paint, canonical slug).
func (s *Server) enrichFromFleetYards(ctx context.Context, username string) (*EnrichmentStats, error) {
	stats := &EnrichmentStats{
		FailedSlugs: []string{},
	}

	fyVehicles, err := s.scheduler.Client().FetchHangar(ctx, username)
	if err != nil {
		return nil, fmt.Errorf("fetching fleetyards hangar: %w", err)
	}

	// Index FleetYards vehicles by slug for matching
	fyBySlug := make(map[string]*models.Vehicle)
	for i := range fyVehicles {
		fyBySlug[fyVehicles[i].ShipSlug] = &fyVehicles[i]
	}

	// Get existing vehicles from DB
	vehicles, err := s.db.GetAllVehicles(ctx)
	if err != nil {
		return nil, fmt.Errorf("reading vehicles: %w", err)
	}

	stats.Total = len(vehicles)

	for _, v := range vehicles {
		// Try to find matching FleetYards entry
		fy, ok := fyBySlug[v.ShipSlug]
		if !ok {
			// Try partial match — FleetYards slug might be a longer version
			for fySlug, fyV := range fyBySlug {
				if containsStr(fySlug, v.ShipSlug) || containsStr(v.ShipSlug, fySlug) {
					fy = fyV
					break
				}
			}
		}
		if fy == nil {
			stats.Skipped++
			stats.FailedSlugs = append(stats.FailedSlugs, v.ShipSlug)
			continue
		}

		// Track what's being added
		originalSlug := v.ShipSlug
		originalLoaner := v.Loaner
		originalPaint := v.PaintName

		// Update with supplementary data
		if err := s.db.EnrichVehicle(ctx, v.ID, fy.ShipSlug, fy.Loaner, fy.PaintName); err != nil {
			log.Warn().Err(err).Str("slug", v.ShipSlug).Msg("failed to enrich vehicle")
			stats.Failed++
			continue
		}

		stats.Enriched++

		// Count what changed
		if fy.ShipSlug != originalSlug && fy.ShipSlug != "" {
			stats.SlugsImproved++
		}
		if fy.Loaner && !originalLoaner {
			stats.LoanersAdded++
		}
		if fy.PaintName != "" && originalPaint == "" {
			stats.PaintsAdded++
		}
	}

	// Limit failed slugs to first 10 for readability
	if len(stats.FailedSlugs) > 10 {
		stats.FailedSlugs = append(stats.FailedSlugs[:10], "...")
	}

	log.Info().
		Int("enriched", stats.Enriched).
		Int("total", stats.Total).
		Int("loaners", stats.LoanersAdded).
		Int("paints", stats.PaintsAdded).
		Msg("fleetyards enrichment complete")

	return stats, nil
}

// --- LLM Configuration ---

func (s *Server) getLLMConfig(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	provider, _ := s.db.GetSetting(ctx, "llm_provider")
	encryptedKey, _ := s.db.GetSetting(ctx, "llm_api_key")
	model, _ := s.db.GetSetting(ctx, "llm_model")

	// Mask the API key for display
	maskedKey := ""
	if encryptedKey != "" {
		decrypted, err := crypto.Decrypt(encryptedKey)
		if err == nil {
			maskedKey = crypto.MaskAPIKey(decrypted)
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"provider":     provider,
		"api_key_set":  encryptedKey != "",
		"api_key_mask": maskedKey,
		"model":        model,
	})
}

func (s *Server) setLLMConfig(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Provider string `json:"provider"`
		APIKey   string `json:"api_key"`
		Model    string `json:"model"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	ctx := r.Context()

	// Check if this is a clear operation (all empty)
	isClearing := req.Provider == "" && req.APIKey == "" && req.Model == ""

	if isClearing {
		// Clear all LLM settings
		if err := s.db.SetSetting(ctx, "llm_provider", ""); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to clear provider")
			return
		}
		if err := s.db.SetSetting(ctx, "llm_api_key", ""); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to clear API key")
			return
		}
		if err := s.db.SetSetting(ctx, "llm_model", ""); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to clear model")
			return
		}

		log.Info().Msg("LLM configuration cleared")

		writeJSON(w, http.StatusOK, map[string]string{
			"message": "LLM configuration cleared",
		})
		return
	}

	// Validate provider for normal save operations
	validProviders := map[string]bool{
		llm.ProviderOpenAI:    true,
		llm.ProviderAnthropic: true,
		llm.ProviderGoogle:    true,
	}
	if !validProviders[req.Provider] {
		writeError(w, http.StatusBadRequest, "Invalid provider")
		return
	}

	// Encrypt API key
	encryptedKey, err := crypto.Encrypt(req.APIKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to encrypt API key")
		return
	}

	// Save settings
	if err := s.db.SetSetting(ctx, "llm_provider", req.Provider); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to save provider")
		return
	}

	if err := s.db.SetSetting(ctx, "llm_api_key", encryptedKey); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to save API key")
		return
	}

	if err := s.db.SetSetting(ctx, "llm_model", req.Model); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to save model")
		return
	}

	log.Info().Str("provider", req.Provider).Msg("LLM configuration updated")

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "LLM configuration saved",
	})
}

func (s *Server) testLLMConnection(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Provider string `json:"provider"`
		APIKey   string `json:"api_key"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	// Validate required fields
	if req.Provider == "" || req.APIKey == "" {
		writeError(w, http.StatusBadRequest, "Provider and API key are required")
		return
	}

	client, err := llm.NewClient(req.Provider, req.APIKey)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	ctx := r.Context()

	// Test connection
	if err := client.TestConnection(ctx); err != nil {
		writeError(w, http.StatusUnauthorized, "API key is invalid: "+err.Error())
		return
	}

	// Fetch available models
	models, err := client.ListModels(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch models: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"models":  models,
	})
}

func (s *Server) generateAIAnalysis(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	log.Info().Msg("AI fleet analysis request received")

	// Get LLM config
	provider, _ := s.db.GetSetting(ctx, "llm_provider")
	encryptedKey, _ := s.db.GetSetting(ctx, "llm_api_key")
	model, _ := s.db.GetSetting(ctx, "llm_model")

	if provider == "" || encryptedKey == "" {
		log.Warn().Msg("AI analysis failed: LLM not configured")
		writeError(w, http.StatusBadRequest, "LLM not configured")
		return
	}

	log.Info().
		Str("provider", provider).
		Str("model", model).
		Msg("Using LLM configuration")

	// Decrypt API key
	apiKey, err := crypto.Decrypt(encryptedKey)
	if err != nil {
		log.Error().Err(err).Msg("Failed to decrypt API key")
		writeError(w, http.StatusInternalServerError, "Failed to decrypt API key")
		return
	}

	// Create client
	client, err := llm.NewClient(provider, apiKey)
	if err != nil {
		log.Error().Err(err).Str("provider", provider).Msg("Failed to create LLM client")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Get fleet data
	vehicles, err := s.db.GetVehiclesWithInsurance(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch vehicles for AI analysis")
		writeError(w, http.StatusInternalServerError, "Failed to fetch vehicles")
		return
	}

	log.Info().
		Int("vehicle_count", len(vehicles)).
		Str("provider", provider).
		Str("model", model).
		Msg("Generating AI fleet analysis...")

	// Generate analysis
	result, err := client.GenerateFleetAnalysis(ctx, model, vehicles)
	if err != nil {
		log.Error().
			Err(err).
			Str("provider", provider).
			Str("model", model).
			Msg("AI analysis failed")
		writeError(w, http.StatusInternalServerError, "AI analysis failed: "+err.Error())
		return
	}

	log.Info().
		Int("result_length", len(result)).
		Str("provider", provider).
		Msg("AI fleet analysis completed successfully")

	// Save analysis to database
	analysisID, err := s.db.SaveAIAnalysis(ctx, provider, model, len(vehicles), result)
	if err != nil {
		log.Error().Err(err).Msg("Failed to save AI analysis to database")
		// Don't fail the request - analysis was successful, just couldn't save
	} else {
		log.Info().Int64("analysis_id", analysisID).Msg("AI analysis saved to database")
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"analysis": result,
		"id":       analysisID,
	})
}

func (s *Server) getLatestAIAnalysis(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	analysis, err := s.db.GetLatestAIAnalysis(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch latest AI analysis")
		writeError(w, http.StatusInternalServerError, "Failed to fetch analysis")
		return
	}

	if analysis == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"analysis": nil,
		})
		return
	}

	writeJSON(w, http.StatusOK, analysis)
}

func (s *Server) getAIAnalysisHistory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	analyses, err := s.db.GetAIAnalysisHistory(ctx, 50)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch AI analysis history")
		writeError(w, http.StatusInternalServerError, "Failed to fetch history")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"history": analyses,
	})
}

func (s *Server) deleteAIAnalysis(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	idStr := chi.URLParam(r, "id")

	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid analysis ID")
		return
	}

	if err := s.db.DeleteAIAnalysis(ctx, id); err != nil {
		log.Error().Err(err).Int64("analysis_id", id).Msg("Failed to delete AI analysis")
		writeError(w, http.StatusInternalServerError, "Failed to delete analysis")
		return
	}

	log.Info().Int64("analysis_id", id).Msg("AI analysis deleted")

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
	})
}

// --- Frontend SPA ---

func (s *Server) debugImports(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get first 5 vehicles
	type debugVehicle struct {
		ID       int    `json:"id"`
		ShipSlug string `json:"ship_slug"`
		ShipName string `json:"ship_name"`
		Source   string `json:"source"`
	}
	var vehicles []debugVehicle
	rows, err := s.db.RawQuery(ctx, "SELECT id, ship_slug, ship_name, source FROM vehicles LIMIT 5")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var v debugVehicle
			rows.Scan(&v.ID, &v.ShipSlug, &v.ShipName, &v.Source)
			vehicles = append(vehicles, v)
		}
	}

	// Get first 5 hangar_imports
	type debugImport struct {
		ID        int    `json:"id"`
		VehicleID int    `json:"vehicle_id"`
		ShipSlug  string `json:"ship_slug"`
		PledgeID  string `json:"pledge_id"`
		LTI       bool   `json:"lti"`
	}
	var imports []debugImport
	rows2, err := s.db.RawQuery(ctx, "SELECT id, vehicle_id, ship_slug, pledge_id, lti FROM hangar_imports LIMIT 5")
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var h debugImport
			rows2.Scan(&h.ID, &h.VehicleID, &h.ShipSlug, &h.PledgeID, &h.LTI)
			imports = append(imports, h)
		}
	}

	// Count of joined rows
	var joinCount int
	s.db.RawQueryRow(ctx, "SELECT COUNT(*) FROM vehicles v INNER JOIN hangar_imports hi ON hi.vehicle_id = v.id").Scan(&joinCount)

	var vehicleCount, importCount int
	s.db.RawQueryRow(ctx, "SELECT COUNT(*) FROM vehicles").Scan(&vehicleCount)
	s.db.RawQueryRow(ctx, "SELECT COUNT(*) FROM hangar_imports").Scan(&importCount)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"vehicle_count":       vehicleCount,
		"import_count":        importCount,
		"join_count":          joinCount,
		"sample_vehicles":     vehicles,
		"sample_imports":      imports,
	})
}

func (s *Server) serveFrontend(r chi.Router) {
	staticDir := s.cfg.StaticDir

	// Check if frontend exists
	if _, err := os.Stat(staticDir); os.IsNotExist(err) {
		log.Warn().Str("dir", staticDir).Msg("frontend static directory not found")
		return
	}

	fs := http.FileServer(http.Dir(staticDir))

	// Serve static files, fall back to index.html for SPA routing
	r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(staticDir, r.URL.Path)

		// Check if file exists
		if _, err := os.Stat(path); os.IsNotExist(err) {
			// SPA fallback: serve index.html
			http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
			return
		}

		fs.ServeHTTP(w, r)
	})
}

// --- Helpers ---

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// slugFromShipCode converts "MISC_Hull_D" -> "hull-d", "ANVL_F7A_Hornet_Mk_I" -> "f7a-hornet-mk-i"
// Strips the manufacturer prefix (first segment) and joins the rest with hyphens.
func slugFromShipCode(code string) string {
	parts := splitOnUnderscore(code)
	if len(parts) <= 1 {
		return toLower(code)
	}
	// Strip manufacturer prefix (first part), join rest with hyphens
	modelParts := parts[1:]
	result := make([]byte, 0, len(code))
	for i, p := range modelParts {
		if p == "" {
			continue
		}
		if i > 0 && len(result) > 0 {
			result = append(result, '-')
		}
		result = append(result, []byte(toLower(p))...)
	}
	return string(result)
}

// slugFromName converts a display name to a slug: "Hull D" -> "hull-d", "A.T.L.S." -> "atls"
// Strips all punctuation except hyphens; spaces become hyphens.
func slugFromName(name string) string {
	result := make([]byte, 0, len(name))
	prevDash := false
	for i := 0; i < len(name); i++ {
		c := name[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		if c == ' ' || c == '_' {
			if !prevDash && len(result) > 0 {
				result = append(result, '-')
				prevDash = true
			}
			continue
		}
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' {
			result = append(result, c)
			prevDash = (c == '-')
		}
		// All other punctuation (dots, commas, etc.) is stripped
	}
	// Trim trailing dashes
	for len(result) > 0 && result[len(result)-1] == '-' {
		result = result[:len(result)-1]
	}
	return string(result)
}

// compactSlug strips ALL non-alphanumeric characters: "a-t-l-s" -> "atls", "f7a-hornet-mk-i" -> "f7ahornetmki"
// Used as a fallback candidate for acronym-style names.
func compactSlug(s string) string {
	result := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') {
			result = append(result, c)
		}
	}
	return string(result)
}

func splitOnUnderscore(s string) []string {
	var parts []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '_' {
			parts = append(parts, s[start:i])
			start = i + 1
		}
	}
	parts = append(parts, s[start:])
	return parts
}

func containsStr(s, substr string) bool {
	if len(substr) == 0 || len(substr) > len(s) {
		return false
	}
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func toLower(s string) string {
	b := make([]byte, len(s))
	for i := range s {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		b[i] = c
	}
	return string(b)
}
