package sync

import (
	"context"
	"fmt"
	"time"

	"github.com/nzvengeance/fleet-manager/internal/config"
	"github.com/nzvengeance/fleet-manager/internal/database"
	"github.com/nzvengeance/fleet-manager/internal/fleetyards"
	"github.com/nzvengeance/fleet-manager/internal/models"
	"github.com/robfig/cron/v3"
	"github.com/rs/zerolog/log"
)

type Scheduler struct {
	db     *database.DB
	client *fleetyards.Client
	cfg    *config.Config
	cron   *cron.Cron
}

func NewScheduler(db *database.DB, client *fleetyards.Client, cfg *config.Config) *Scheduler {
	return &Scheduler{
		db:     db,
		client: client,
		cfg:    cfg,
		cron:   cron.New(),
	}
}

// Client returns the FleetYards API client (used for enrichment)
func (s *Scheduler) Client() *fleetyards.Client {
	return s.client
}

// Start begins the scheduled sync jobs
func (s *Scheduler) Start() error {
	// Schedule nightly ship database sync (reference data only, not user's hangar)
	_, err := s.cron.AddFunc(s.cfg.SyncSchedule, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()

		log.Info().Msg("scheduled ship sync starting")
		if err := s.SyncShips(ctx); err != nil {
			log.Error().Err(err).Msg("scheduled ship sync failed")
		}
	})
	if err != nil {
		return fmt.Errorf("adding cron job: %w", err)
	}

	s.cron.Start()
	log.Info().Str("schedule", s.cfg.SyncSchedule).Msg("sync scheduler started")

	// Run ship DB sync on startup if configured
	if s.cfg.SyncOnStartup {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
			defer cancel()

			count, _ := s.db.GetShipCount(ctx)
			if count == 0 {
				log.Info().Msg("no ships in database, running startup sync")
				if err := s.SyncShips(ctx); err != nil {
					log.Error().Err(err).Msg("startup ship sync failed")
				}
			} else {
				log.Info().Int("count", count).Msg("ships already in database, skipping startup sync")
			}
		}()
	}

	return nil
}

// Stop gracefully stops the scheduler
func (s *Scheduler) Stop() {
	ctx := s.cron.Stop()
	<-ctx.Done()
	log.Info().Msg("sync scheduler stopped")
}

// SyncShips fetches all ships from FleetYards and upserts them
func (s *Scheduler) SyncShips(ctx context.Context) error {
	syncID, _ := s.db.InsertSyncStatus(ctx, &models.SyncStatus{
		SyncType: "ships",
		Status:   "running",
	})

	ships, err := s.client.FetchAllShips(ctx)
	if err != nil {
		s.db.UpdateSyncStatus(ctx, syncID, "error", 0, err.Error())
		return fmt.Errorf("fetching ships: %w", err)
	}

	count := 0
	for i := range ships {
		if err := s.db.UpsertShip(ctx, &ships[i]); err != nil {
			log.Warn().Err(err).Str("slug", ships[i].Slug).Msg("failed to upsert ship")
			continue
		}
		count++
	}

	s.db.UpdateSyncStatus(ctx, syncID, "success", count, "")
	log.Info().Int("synced", count).Int("total", len(ships)).Msg("ship sync complete")
	return nil
}

// SyncHangarForUser fetches the user's public hangar from FleetYards.
// Clears all existing vehicles and hangar imports — this is a full replacement.
func (s *Scheduler) SyncHangarForUser(ctx context.Context, username string) error {
	if username == "" {
		return fmt.Errorf("FleetYards username not configured")
	}

	syncID, _ := s.db.InsertSyncStatus(ctx, &models.SyncStatus{
		SyncType: "hangar",
		Status:   "running",
	})

	vehicles, err := s.client.FetchHangar(ctx, username)
	if err != nil {
		s.db.UpdateSyncStatus(ctx, syncID, "error", 0, err.Error())
		return fmt.Errorf("fetching hangar: %w", err)
	}

	// Clear ALL existing vehicles and imports (clean slate)
	if err := s.db.ClearAllVehicles(ctx); err != nil {
		s.db.UpdateSyncStatus(ctx, syncID, "error", 0, err.Error())
		return fmt.Errorf("clearing vehicles: %w", err)
	}
	s.db.ClearHangarImports(ctx)

	count := 0
	for i := range vehicles {
		if _, err := s.db.InsertVehicle(ctx, &vehicles[i]); err != nil {
			log.Warn().Err(err).Str("slug", vehicles[i].ShipSlug).Msg("failed to insert vehicle")
			continue
		}
		count++
	}

	s.db.UpdateSyncStatus(ctx, syncID, "success", count, "")
	s.db.SetSetting(ctx, "hangar_source", "fleetyards")
	log.Info().Int("synced", count).Str("user", username).Msg("hangar sync complete")
	return nil
}
