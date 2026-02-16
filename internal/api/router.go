package api

import (
	"context"
	"encoding/json"
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
		llmRateLimiter: rate.NewLimiter(rate.Every(10*time.Second), 1),
	}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(5 * time.Minute))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{s.cfg.BaseURL},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// API routes
	r.Route("/api", func(r chi.Router) {
		r.Get("/health", s.healthCheck)
		r.Get("/status", s.getStatus)

		// Ship reference database (all vehicles in the game)
		r.Route("/ships", func(r chi.Router) {
			r.Get("/", s.listShips)
			r.Get("/{slug}", s.getShip)
		})

		// User's fleet
		r.Route("/vehicles", func(r chi.Router) {
			r.Get("/", s.listUserFleet)
			r.Get("/with-insurance", s.listUserFleet) // Same endpoint — insurance is part of user_fleet
		})

		// HangarXplor import
		r.Route("/import", func(r chi.Router) {
			r.Post("/hangarxplor", s.importHangarXplor)
		})

		// Settings
		r.Route("/settings", func(r chi.Router) {
			// LLM configuration
			r.Get("/llm-config", s.getLLMConfig)
			r.Put("/llm-config", s.setLLMConfig)
		})

		// LLM operations
		r.Route("/llm", func(r chi.Router) {
			r.With(s.rateLimitLLM).Post("/test-connection", s.testLLMConnection)
			r.With(s.rateLimitLLM).Post("/generate-analysis", s.generateAIAnalysis)

			r.Get("/latest-analysis", s.getLatestAIAnalysis)
			r.Get("/analysis-history", s.getAIAnalysisHistory)
			r.Delete("/analysis/{id}", s.deleteAIAnalysis)
		})

		// Fleet analysis
		r.Get("/analysis", s.getAnalysis)

		// Sync management
		r.Route("/sync", func(r chi.Router) {
			r.Get("/status", s.getSyncStatus)
			r.Post("/images", s.triggerImageSync)
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

func (s *Server) getStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vehicleCount, _ := s.db.GetVehicleCount(ctx)
	userID := s.db.GetDefaultUserID(ctx)
	fleetCount, _ := s.db.GetUserFleetCount(ctx, userID)
	syncHistory, _ := s.db.GetLatestSyncHistory(ctx)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ships":       vehicleCount,
		"vehicles":    fleetCount,
		"sync_status": syncHistory,
		"config": map[string]interface{}{
			"sync_schedule": s.cfg.SyncSchedule,
			"db_driver":     s.cfg.DBDriver,
		},
	})
}

// --- Ships (Reference Database) ---

func (s *Server) listShips(w http.ResponseWriter, r *http.Request) {
	vehicles, err := s.db.GetAllVehicles(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch ships: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, vehicles)
}

func (s *Server) getShip(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	vehicle, err := s.db.GetVehicleBySlug(r.Context(), slug)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if vehicle == nil {
		writeError(w, http.StatusNotFound, "Ship not found")
		return
	}
	writeJSON(w, http.StatusOK, vehicle)
}

// --- User Fleet ---

func (s *Server) listUserFleet(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := s.db.GetDefaultUserID(ctx)
	fleet, err := s.db.GetUserFleet(ctx, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if fleet == nil {
		fleet = []models.UserFleetEntry{}
	}
	writeJSON(w, http.StatusOK, fleet)
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
	userID := s.db.GetDefaultUserID(ctx)

	// Resolve insurance type IDs once before loop
	ltiID, err := s.db.GetInsuranceTypeIDByKey(ctx, "lti")
	if err != nil {
		log.Warn().Err(err).Msg("missing insurance_types seed: lti")
	}
	unknownInsID, err := s.db.GetInsuranceTypeIDByKey(ctx, "unknown")
	if err != nil {
		log.Warn().Err(err).Msg("missing insurance_types seed: unknown")
	}
	ins120ID, err := s.db.GetInsuranceTypeIDByKey(ctx, "120_month")
	if err != nil {
		log.Warn().Err(err).Msg("missing insurance_types seed: 120_month")
	}
	ins72ID, err := s.db.GetInsuranceTypeIDByKey(ctx, "72_month")
	if err != nil {
		log.Warn().Err(err).Msg("missing insurance_types seed: 72_month")
	}
	ins6ID, err := s.db.GetInsuranceTypeIDByKey(ctx, "6_month")
	if err != nil {
		log.Warn().Err(err).Msg("missing insurance_types seed: 6_month")
	}
	ins3ID, err := s.db.GetInsuranceTypeIDByKey(ctx, "3_month")
	if err != nil {
		log.Warn().Err(err).Msg("missing insurance_types seed: 3_month")
	}
	standardID, err := s.db.GetInsuranceTypeIDByKey(ctx, "standard")
	if err != nil {
		log.Warn().Err(err).Msg("missing insurance_types seed: standard")
	}

	// Clean slate — clear existing fleet for this user
	if err := s.db.ClearUserFleet(ctx, userID); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to clear fleet: "+err.Error())
		return
	}

	imported := 0
	for _, entry := range entries {
		displayName := entry.Name

		// Generate slug candidates
		codeSlug := slugFromShipCode(entry.ShipCode)
		nameSlug := slugFromName(displayName)
		lookupSlug := ""
		if entry.Lookup != "" {
			lookupSlug = slugFromName(entry.Lookup)
		}
		compactCode := compactSlug(codeSlug)
		compactName := compactSlug(nameSlug)

		// Find matching vehicle in reference table
		candidates := []string{codeSlug, nameSlug, lookupSlug, compactCode, compactName}
		matchedSlug := s.db.FindVehicleSlug(ctx, candidates, displayName)
		if matchedSlug == "" {
			matchedSlug = codeSlug
		}

		// Resolve vehicle ID from reference table
		vehicleID, err := s.db.GetVehicleIDBySlug(ctx, matchedSlug)
		if err != nil {
			// Vehicle not in reference DB — create a stub entry
			stubVehicle := &models.Vehicle{
				Slug:             matchedSlug,
				Name:             displayName,
				ManufacturerCode: entry.ManufacturerCode,
			}
			vehicleID, err = s.db.UpsertVehicle(ctx, stubVehicle)
			if err != nil {
				log.Warn().Err(err).Str("ship", displayName).Str("slug", matchedSlug).Msg("failed to create stub vehicle")
				continue
			}
		}

		// Detect custom name
		customName := ""
		if entry.ShipName != "" {
			snLower := toLower(entry.ShipName)
			codeLower := toLower(entry.ShipCode)
			nameLower := toLower(displayName)
			isCustom := true
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

		// Determine insurance type
		var insuranceTypeID *int
		if entry.LTI {
			insuranceTypeID = &ltiID
		} else {
			insLower := toLower(entry.Insurance)
			switch {
			case containsStr(insLower, "120"):
				insuranceTypeID = &ins120ID
			case containsStr(insLower, "72"):
				insuranceTypeID = &ins72ID
			case containsStr(insLower, "6 month"), containsStr(insLower, "6-month"):
				insuranceTypeID = &ins6ID
			case containsStr(insLower, "3 month"), containsStr(insLower, "3-month"):
				insuranceTypeID = &ins3ID
			case containsStr(insLower, "standard"):
				insuranceTypeID = &standardID
			default:
				insuranceTypeID = &unknownInsID
			}
		}

		// Insert user fleet entry
		fleetEntry := &models.UserFleetEntry{
			UserID:          userID,
			VehicleID:       vehicleID,
			InsuranceTypeID: insuranceTypeID,
			Warbond:         entry.Warbond,
			PledgeID:        entry.PledgeID,
			PledgeName:      entry.PledgeName,
			PledgeCost:      entry.PledgeCost,
			PledgeDate:      entry.PledgeDate,
			CustomName:      customName,
		}

		if _, err := s.db.InsertUserFleetEntry(ctx, fleetEntry); err != nil {
			log.Warn().Err(err).Str("ship", displayName).Int("vehicle_id", vehicleID).Msg("failed to insert fleet entry")
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

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"imported": imported,
		"total":    len(entries),
		"message":  "Import complete",
	})
}

// --- Analysis ---

func (s *Server) getAnalysis(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := s.db.GetDefaultUserID(ctx)

	fleet, err := s.db.GetUserFleet(ctx, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	allVehicles, err := s.db.GetAllVehicles(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	result := analysis.AnalyzeFleet(fleet, allVehicles)
	writeJSON(w, http.StatusOK, result)
}

// --- Sync ---

func (s *Server) getSyncStatus(w http.ResponseWriter, r *http.Request) {
	statuses, err := s.db.GetLatestSyncHistory(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, statuses)
}

func (s *Server) triggerImageSync(w http.ResponseWriter, r *http.Request) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()
		if err := s.scheduler.SyncImages(ctx); err != nil {
			log.Error().Err(err).Msg("manual image sync failed")
		}
	}()

	writeJSON(w, http.StatusAccepted, map[string]string{
		"message": "Image sync started",
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

// --- LLM Configuration ---

func (s *Server) getLLMConfig(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := s.db.GetDefaultUserID(ctx)

	config, err := s.db.GetUserLLMConfig(ctx, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch LLM config")
		return
	}

	provider := ""
	maskedKey := ""
	model := ""
	apiKeySet := false

	if config != nil {
		provider = config.Provider
		model = config.Model
		if config.EncryptedAPIKey != "" {
			apiKeySet = true
			decrypted, err := crypto.Decrypt(config.EncryptedAPIKey)
			if err == nil {
				maskedKey = crypto.MaskAPIKey(decrypted)
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"provider":     provider,
		"api_key_set":  apiKeySet,
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
	userID := s.db.GetDefaultUserID(ctx)

	// Check if this is a clear operation (all empty)
	if req.Provider == "" && req.APIKey == "" && req.Model == "" {
		if err := s.db.ClearUserLLMConfigs(ctx, userID); err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to clear LLM config")
			return
		}
		log.Info().Msg("LLM configuration cleared")
		writeJSON(w, http.StatusOK, map[string]string{"message": "LLM configuration cleared"})
		return
	}

	// Validate provider
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

	if err := s.db.UpsertUserLLMConfig(ctx, userID, req.Provider, encryptedKey, req.Model); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to save LLM config")
		return
	}

	log.Info().Str("provider", req.Provider).Msg("LLM configuration updated")
	writeJSON(w, http.StatusOK, map[string]string{"message": "LLM configuration saved"})
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

	if err := client.TestConnection(ctx); err != nil {
		writeError(w, http.StatusUnauthorized, "API key is invalid: "+err.Error())
		return
	}

	availableModels, err := client.ListModels(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch models: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"models":  availableModels,
	})
}

func (s *Server) generateAIAnalysis(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := s.db.GetDefaultUserID(ctx)

	log.Info().Msg("AI fleet analysis request received")

	// Get LLM config
	llmConfig, err := s.db.GetUserLLMConfig(ctx, userID)
	if err != nil || llmConfig == nil || llmConfig.EncryptedAPIKey == "" {
		log.Warn().Msg("AI analysis failed: LLM not configured")
		writeError(w, http.StatusBadRequest, "LLM not configured")
		return
	}

	log.Info().
		Str("provider", llmConfig.Provider).
		Str("model", llmConfig.Model).
		Msg("Using LLM configuration")

	// Decrypt API key
	apiKey, err := crypto.Decrypt(llmConfig.EncryptedAPIKey)
	if err != nil {
		log.Error().Err(err).Msg("Failed to decrypt API key")
		writeError(w, http.StatusInternalServerError, "Failed to decrypt API key")
		return
	}

	client, err := llm.NewClient(llmConfig.Provider, apiKey)
	if err != nil {
		log.Error().Err(err).Str("provider", llmConfig.Provider).Msg("Failed to create LLM client")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Get fleet data
	fleet, err := s.db.GetUserFleet(ctx, userID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch fleet for AI analysis")
		writeError(w, http.StatusInternalServerError, "Failed to fetch fleet")
		return
	}

	log.Info().
		Int("vehicle_count", len(fleet)).
		Str("provider", llmConfig.Provider).
		Str("model", llmConfig.Model).
		Msg("Generating AI fleet analysis...")

	// Generate analysis
	result, err := client.GenerateFleetAnalysis(ctx, llmConfig.Model, fleet)
	if err != nil {
		log.Error().
			Err(err).
			Str("provider", llmConfig.Provider).
			Str("model", llmConfig.Model).
			Msg("AI analysis failed")
		writeError(w, http.StatusInternalServerError, "AI analysis failed: "+err.Error())
		return
	}

	log.Info().
		Int("result_length", len(result)).
		Str("provider", llmConfig.Provider).
		Msg("AI fleet analysis completed successfully")

	// Save analysis
	analysisID, err := s.db.SaveAIAnalysis(ctx, userID, llmConfig.Provider, llmConfig.Model, len(fleet), result)
	if err != nil {
		log.Error().Err(err).Msg("Failed to save AI analysis to database")
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
	userID := s.db.GetDefaultUserID(ctx)

	a, err := s.db.GetLatestAIAnalysis(ctx, userID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch latest AI analysis")
		writeError(w, http.StatusInternalServerError, "Failed to fetch analysis")
		return
	}

	if a == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"analysis": nil})
		return
	}

	writeJSON(w, http.StatusOK, a)
}

func (s *Server) getAIAnalysisHistory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := s.db.GetDefaultUserID(ctx)

	analyses, err := s.db.GetAIAnalysisHistory(ctx, userID, 50)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch AI analysis history")
		writeError(w, http.StatusInternalServerError, "Failed to fetch history")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"history": analyses})
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
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

// --- Debug ---

func (s *Server) debugImports(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := s.db.GetDefaultUserID(ctx)

	vehicleCount, _ := s.db.GetVehicleCount(ctx)
	fleetCount, _ := s.db.GetUserFleetCount(ctx, userID)

	// Get sample fleet entries
	fleet, _ := s.db.GetUserFleet(ctx, userID)
	sampleSize := len(fleet)
	if sampleSize > 5 {
		sampleSize = 5
	}

	type debugEntry struct {
		ID          int    `json:"id"`
		VehicleID   int    `json:"vehicle_id"`
		VehicleName string `json:"vehicle_name"`
		VehicleSlug string `json:"vehicle_slug"`
		Insurance   string `json:"insurance"`
		CustomName  string `json:"custom_name,omitempty"`
	}

	var samples []debugEntry
	for _, e := range fleet[:sampleSize] {
		samples = append(samples, debugEntry{
			ID:          e.ID,
			VehicleID:   e.VehicleID,
			VehicleName: e.VehicleName,
			VehicleSlug: e.VehicleSlug,
			Insurance:   e.InsuranceLabel,
			CustomName:  e.CustomName,
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"vehicle_ref_count": vehicleCount,
		"user_fleet_count":  fleetCount,
		"sample_fleet":      samples,
	})
}

// --- Frontend SPA ---

func (s *Server) serveFrontend(r chi.Router) {
	staticDir := s.cfg.StaticDir

	if _, err := os.Stat(staticDir); os.IsNotExist(err) {
		log.Warn().Str("dir", staticDir).Msg("frontend static directory not found")
		return
	}

	fs := http.FileServer(http.Dir(staticDir))

	r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(staticDir, r.URL.Path)

		if _, err := os.Stat(path); os.IsNotExist(err) {
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
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Warn().Err(err).Msg("failed to write JSON response")
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// slugFromShipCode converts "MISC_Hull_D" -> "hull-d", "ANVL_F7A_Hornet_Mk_I" -> "f7a-hornet-mk-i"
func slugFromShipCode(code string) string {
	parts := splitOnUnderscore(code)
	if len(parts) <= 1 {
		return toLower(code)
	}
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
	}
	for len(result) > 0 && result[len(result)-1] == '-' {
		result = result[:len(result)-1]
	}
	return string(result)
}

// compactSlug strips ALL non-alphanumeric characters: "a-t-l-s" -> "atls"
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
