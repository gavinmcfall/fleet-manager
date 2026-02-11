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

// Start begins the scheduled sync jobs
func (s *Scheduler) Start() error {
	// Schedule nightly ship database sync
	_, err := s.cron.AddFunc(s.cfg.SyncSchedule, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()

		log.Info().Msg("scheduled ship sync starting")
		if err := s.SyncShips(ctx); err != nil {
			log.Error().Err(err).Msg("scheduled ship sync failed")
		}

		// Also sync hangar if username configured
		if s.cfg.FleetYardsUser != "" {
			log.Info().Msg("scheduled hangar sync starting")
			if err := s.SyncHangar(ctx); err != nil {
				log.Error().Err(err).Msg("scheduled hangar sync failed")
			}
		}
	})
	if err != nil {
		return fmt.Errorf("adding cron job: %w", err)
	}

	s.cron.Start()
	log.Info().Str("schedule", s.cfg.SyncSchedule).Msg("sync scheduler started")

	// Run on startup if configured
	if s.cfg.SyncOnStartup {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
			defer cancel()

			// Check if we already have data
			count, _ := s.db.GetShipCount(ctx)
			if count == 0 {
				log.Info().Msg("no ships in database, running startup sync")
				if err := s.SyncShips(ctx); err != nil {
					log.Error().Err(err).Msg("startup ship sync failed")
				}
			} else {
				log.Info().Int("count", count).Msg("ships already in database, skipping startup sync")
			}

			if s.cfg.FleetYardsUser != "" {
				vCount, _ := s.db.GetVehicleCount(ctx)
				if vCount == 0 {
					log.Info().Msg("no vehicles in database, running startup hangar sync")
					if err := s.SyncHangar(ctx); err != nil {
						log.Error().Err(err).Msg("startup hangar sync failed")
					}
				}
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

// SyncHangar fetches the user's hangar from FleetYards and upserts vehicles
func (s *Scheduler) SyncHangar(ctx context.Context) error {
	if s.cfg.FleetYardsUser == "" {
		return fmt.Errorf("FLEETYARDS_USER not configured")
	}

	syncID, _ := s.db.InsertSyncStatus(ctx, &models.SyncStatus{
		SyncType: "hangar",
		Status:   "running",
	})

	vehicles, err := s.client.FetchHangar(ctx, s.cfg.FleetYardsUser)
	if err != nil {
		s.db.UpdateSyncStatus(ctx, syncID, "error", 0, err.Error())
		return fmt.Errorf("fetching hangar: %w", err)
	}

	// Clear existing fleetyards vehicles and re-insert
	if err := s.db.ClearVehiclesBySource(ctx, "fleetyards"); err != nil {
		s.db.UpdateSyncStatus(ctx, syncID, "error", 0, err.Error())
		return fmt.Errorf("clearing vehicles: %w", err)
	}

	count := 0
	for i := range vehicles {
		if err := s.db.UpsertVehicle(ctx, &vehicles[i]); err != nil {
			log.Warn().Err(err).Str("slug", vehicles[i].ShipSlug).Msg("failed to upsert vehicle")
			continue
		}
		count++
	}

	s.db.UpdateSyncStatus(ctx, syncID, "success", count, "")
	log.Info().Int("synced", count).Str("user", s.cfg.FleetYardsUser).Msg("hangar sync complete")
	return nil
}
