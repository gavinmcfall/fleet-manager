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
	// Schedule nightly SC Wiki sync (primary data source)
	if s.scwiki != nil {
		_, err := s.cron.AddFunc(s.cfg.SyncSchedule, func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()

			log.Info().Msg("scheduled SC Wiki sync starting")
			if err := s.SyncSCWiki(ctx); err != nil {
				log.Error().Err(err).Msg("scheduled SC Wiki sync failed")
			}

			// Run image sync after SC Wiki sync so vehicles exist
			log.Info().Msg("scheduled FleetYards image sync starting")
			if err := s.SyncImages(ctx); err != nil {
				log.Error().Err(err).Msg("scheduled FleetYards image sync failed")
			}
		})
		if err != nil {
			return fmt.Errorf("adding SC Wiki cron job: %w", err)
		}
	}

	s.cron.Start()
	log.Info().Str("schedule", s.cfg.SyncSchedule).Msg("sync scheduler started")

	// Run startup sync if configured
	if s.cfg.SyncOnStartup {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()

			// SC Wiki sync is the primary data source — run first
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

			// FleetYards image sync — runs after SC Wiki so vehicles exist to attach images to
			count, _ := s.db.GetVehicleCount(ctx)
			if count > 0 {
				log.Info().Msg("running startup FleetYards image sync")
				if err := s.SyncImages(ctx); err != nil {
					log.Error().Err(err).Msg("startup FleetYards image sync failed")
				}
			} else {
				log.Warn().Msg("no vehicles in database after SC Wiki sync, skipping image sync")
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

// SyncImages fetches store images from FleetYards and updates the image columns on existing vehicles.
// This is an image-only sync — all other ship data comes from SC Wiki.
func (s *Scheduler) SyncImages(ctx context.Context) error {
	syncID, _ := s.db.InsertSyncHistory(ctx, 2, "images", "running") // 2 = fleetyards

	images, err := s.client.FetchAllShipImages(ctx)
	if err != nil {
		s.db.UpdateSyncHistory(ctx, syncID, "error", 0, err.Error())
		return fmt.Errorf("fetching images: %w", err)
	}

	count := 0
	for _, img := range images {
		if err := s.db.UpdateVehicleImages(ctx, img.Slug, img.ImageURL, img.ImageURLSmall, img.ImageURLMedium, img.ImageURLLarge); err != nil {
			log.Warn().Err(err).Str("slug", img.Slug).Msg("failed to update vehicle images")
			continue
		}
		count++
	}

	s.db.UpdateSyncHistory(ctx, syncID, "success", count, "")
	log.Info().Int("updated", count).Int("total", len(images)).Msg("FleetYards image sync complete")
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
