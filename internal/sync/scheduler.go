package sync

import (
	"context"
	"fmt"
	"time"

	"github.com/nzvengeance/fleet-manager/internal/config"
	"github.com/nzvengeance/fleet-manager/internal/database"
	"github.com/nzvengeance/fleet-manager/internal/fleetyards"
	"github.com/nzvengeance/fleet-manager/internal/scwiki"
	"github.com/robfig/cron/v3"
	"github.com/rs/zerolog/log"
)

type Scheduler struct {
	db     *database.DB
	client *fleetyards.Client
	scwiki *scwiki.Syncer
	cfg    *config.Config
	cron   *cron.Cron
}

func NewScheduler(db *database.DB, client *fleetyards.Client, cfg *config.Config) *Scheduler {
	var scwikiSyncer *scwiki.Syncer
	if cfg.SCWikiEnabled {
		scwikiClient := scwiki.NewClient(cfg.SCWikiRateLimit, cfg.SCWikiBurst)
		scwikiSyncer = scwiki.NewSyncer(scwikiClient, db)
		log.Info().
			Float64("rate_limit", cfg.SCWikiRateLimit).
			Int("burst", cfg.SCWikiBurst).
			Msg("SC Wiki API sync enabled")
	}

	return &Scheduler{
		db:     db,
		client: client,
		scwiki: scwikiSyncer,
		cfg:    cfg,
		cron:   cron.New(),
	}
}

// Start begins the scheduled sync jobs
func (s *Scheduler) Start() error {
	// Schedule nightly FleetYards reference sync (images, specs)
	_, err := s.cron.AddFunc(s.cfg.SyncSchedule, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()

		log.Info().Msg("scheduled FleetYards reference sync starting")
		if err := s.SyncShips(ctx); err != nil {
			log.Error().Err(err).Msg("scheduled FleetYards reference sync failed")
		}
	})
	if err != nil {
		return fmt.Errorf("adding cron job: %w", err)
	}

	// Schedule nightly SC Wiki sync if enabled
	if s.scwiki != nil {
		_, err := s.cron.AddFunc(s.cfg.SyncSchedule, func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()

			log.Info().Msg("scheduled SC Wiki sync starting")
			if err := s.SyncSCWiki(ctx); err != nil {
				log.Error().Err(err).Msg("scheduled SC Wiki sync failed")
			}
		})
		if err != nil {
			return fmt.Errorf("adding SC Wiki cron job: %w", err)
		}
	}

	s.cron.Start()
	log.Info().Str("schedule", s.cfg.SyncSchedule).Msg("sync scheduler started")

	// Run reference sync on startup if configured
	if s.cfg.SyncOnStartup {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()

			count, _ := s.db.GetVehicleCount(ctx)
			if count == 0 {
				log.Info().Msg("no vehicles in database, running startup sync")
				if err := s.SyncShips(ctx); err != nil {
					log.Error().Err(err).Msg("startup FleetYards sync failed")
				}
			} else {
				log.Info().Int("count", count).Msg("vehicles already in database, skipping FleetYards startup sync")
			}

			// Also run SC Wiki sync on startup to populate manufacturers, components, ports
			if s.scwiki != nil {
				mfgCount, _ := s.db.GetManufacturerCount(ctx)
				if mfgCount == 0 {
					log.Info().Msg("no manufacturers in database, running SC Wiki startup sync")
					if err := s.SyncSCWiki(ctx); err != nil {
						log.Error().Err(err).Msg("startup SC Wiki sync failed")
					}
				} else {
					log.Info().Int("count", mfgCount).Msg("manufacturers already in database, skipping SC Wiki startup sync")
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

// SyncShips fetches all ships from FleetYards and upserts them into the unified vehicles table.
// FleetYards provides images, pledge pricing, focus, specs, and production status.
// The COALESCE-based upsert preserves any SC Wiki data already present on the same slug.
func (s *Scheduler) SyncShips(ctx context.Context) error {
	syncID, _ := s.db.InsertSyncHistory(ctx, 2, "ships", "running") // 2 = fleetyards

	vehicles, err := s.client.FetchAllShips(ctx)
	if err != nil {
		s.db.UpdateSyncHistory(ctx, syncID, "error", 0, err.Error())
		return fmt.Errorf("fetching ships: %w", err)
	}

	count := 0
	for i := range vehicles {
		v := &vehicles[i]

		// Resolve manufacturer_id from name/code (FleetYards provides name/code, not DB id)
		if (v.ManufacturerName != "" || v.ManufacturerCode != "") && v.ManufacturerID == nil {
			if id, err := s.db.ResolveManufacturerID(ctx, v.ManufacturerName, v.ManufacturerCode); err == nil {
				v.ManufacturerID = &id
				// Backfill manufacturer code if FleetYards provides it
				if v.ManufacturerCode != "" {
					s.db.UpdateManufacturerCode(ctx, id, v.ManufacturerCode)
				}
			}
		}

		// Resolve production_status_id from string key
		if v.ProductionStatus != "" && v.ProductionStatusID == nil {
			if id, err := s.db.GetProductionStatusIDByKey(ctx, v.ProductionStatus); err == nil {
				v.ProductionStatusID = &id
			}
		}

		if _, err := s.db.UpsertVehicle(ctx, v); err != nil {
			log.Warn().Err(err).Str("slug", v.Slug).Msg("failed to upsert vehicle")
			continue
		}
		count++
	}

	s.db.UpdateSyncHistory(ctx, syncID, "success", count, "")
	log.Info().Int("synced", count).Int("total", len(vehicles)).Msg("FleetYards reference sync complete")
	return nil
}

// SyncSCWiki syncs Star Citizen data from SC Wiki API
func (s *Scheduler) SyncSCWiki(ctx context.Context) error {
	if s.scwiki == nil {
		return fmt.Errorf("SC Wiki API sync not enabled (set SC_WIKI_ENABLED=true)")
	}

	log.Info().Msg("SC Wiki API sync starting")
	if err := s.scwiki.SyncAll(ctx); err != nil {
		return fmt.Errorf("SC Wiki API sync failed: %w", err)
	}

	log.Info().Msg("SC Wiki API sync complete")
	return nil
}
