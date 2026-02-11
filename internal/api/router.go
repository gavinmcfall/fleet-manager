package api

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/nzvengeance/fleet-manager/internal/analysis"
	"github.com/nzvengeance/fleet-manager/internal/config"
	"github.com/nzvengeance/fleet-manager/internal/database"
	"github.com/nzvengeance/fleet-manager/internal/models"
	syncsvc "github.com/nzvengeance/fleet-manager/internal/sync"
	"github.com/rs/zerolog/log"
)

type Server struct {
	db        *database.DB
	cfg       *config.Config
	scheduler *syncsvc.Scheduler
}

func NewServer(db *database.DB, cfg *config.Config, scheduler *syncsvc.Scheduler) *Server {
	return &Server{db: db, cfg: cfg, scheduler: scheduler}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))
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

		// Fleet analysis
		r.Get("/analysis", s.getAnalysis)

		// Sync management
		r.Route("/sync", func(r chi.Router) {
			r.Get("/status", s.getSyncStatus)
			r.Post("/ships", s.triggerShipSync)
			r.Post("/hangar", s.triggerHangarSync)
		})
	})

	// Serve frontend SPA
	s.serveFrontend(r)

	return r
}

// --- Health & Status ---

func (s *Server) healthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) getStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	shipCount, _ := s.db.GetShipCount(ctx)
	vehicleCount, _ := s.db.GetVehicleCount(ctx)
	syncStatus, _ := s.db.GetLatestSyncStatus(ctx)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ships":       shipCount,
		"vehicles":    vehicleCount,
		"sync_status": syncStatus,
		"config": map[string]interface{}{
			"fleetyards_user": s.cfg.FleetYardsUser,
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

	// Clear existing imports and re-import
	if err := s.db.ClearHangarImports(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to clear old imports: "+err.Error())
		return
	}

	// Also upsert as vehicles with source "hangarxplor"
	if err := s.db.ClearVehiclesBySource(ctx, "hangarxplor"); err != nil {
		log.Warn().Err(err).Msg("failed to clear hangarxplor vehicles")
	}

	imported := 0
	for _, entry := range entries {
		// Create/update vehicle
		v := &models.Vehicle{
			ShipSlug:         slugFromShipCode(entry.ShipCode),
			ShipName:         entry.Name,
			CustomName:       "",
			ManufacturerName: entry.ManufacturerName,
			ManufacturerCode: entry.ManufacturerCode,
			Source:           "hangarxplor",
		}
		s.db.UpsertVehicle(ctx, v)

		// Create import detail
		h := &models.HangarImportDetail{
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
			log.Warn().Err(err).Str("ship", entry.Name).Msg("failed to import hangar entry")
			continue
		}
		imported++
	}

	log.Info().Int("imported", imported).Int("total", len(entries)).Msg("hangarxplor import complete")

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
	if s.cfg.FleetYardsUser == "" {
		writeError(w, http.StatusBadRequest, "FLEETYARDS_USER not configured")
		return
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		if err := s.scheduler.SyncHangar(ctx); err != nil {
			log.Error().Err(err).Msg("manual hangar sync failed")
		}
	}()

	writeJSON(w, http.StatusAccepted, map[string]string{
		"message": "Hangar sync started",
	})
}

// --- Frontend SPA ---

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

// slugFromShipCode converts "MISC_Fortune" -> "fortune"
func slugFromShipCode(code string) string {
	parts := splitOnUnderscore(code)
	if len(parts) > 1 {
		return toLower(parts[len(parts)-1])
	}
	return toLower(code)
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
