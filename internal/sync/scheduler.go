package sync

import (
	"context"
	"fmt"
	"strings"
	gosync "sync"
	"time"

	"github.com/nzvengeance/fleet-manager/internal/config"
	"github.com/nzvengeance/fleet-manager/internal/database"
	"github.com/nzvengeance/fleet-manager/internal/fleetyards"
	"github.com/nzvengeance/fleet-manager/internal/models"
	"github.com/nzvengeance/fleet-manager/internal/rsi"
	"github.com/nzvengeance/fleet-manager/internal/scunpacked"
	"github.com/nzvengeance/fleet-manager/internal/scwiki"
	"github.com/robfig/cron/v3"
	"github.com/rs/zerolog/log"
)

type Scheduler struct {
	db         *database.DB
	client     *fleetyards.Client
	scwiki     *scwiki.Syncer
	scunpacked *scunpacked.Syncer
	rsiAPI     *rsi.Syncer
	cfg        *config.Config
	cron       *cron.Cron
	syncMu     gosync.Mutex // prevents concurrent sync operations
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

	var scunpackedSyncer *scunpacked.Syncer
	if cfg.ScunpackedDataPath != "" {
		scunpackedSyncer = scunpacked.NewSyncer(db, cfg.ScunpackedDataPath)
		log.Info().Str("path", cfg.ScunpackedDataPath).Msg("scunpacked paint sync enabled")
	}

	var rsiAPISyncer *rsi.Syncer
	if cfg.RSIAPIEnabled {
		rsiClient := rsi.NewClient(cfg.RSIRateLimit, cfg.RSIBaseURL)
		rsiAPISyncer = rsi.NewSyncer(rsiClient, db)
		log.Info().Msg("RSI API image sync enabled")
	}

	return &Scheduler{
		db:         db,
		client:     client,
		scwiki:     scwikiSyncer,
		scunpacked: scunpackedSyncer,
		rsiAPI:     rsiAPISyncer,
		cfg:        cfg,
		cron:       cron.New(),
	}
}

// Start begins the scheduled sync jobs
func (s *Scheduler) Start() error {
	// Schedule nightly SC Wiki sync (primary data source)
	if s.scwiki != nil {
		_, err := s.cron.AddFunc(s.cfg.SyncSchedule, func() {
			s.syncMu.Lock()
			defer s.syncMu.Unlock()

			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()

			log.Info().Msg("scheduled SC Wiki sync starting")
			if err := s.syncSCWiki(ctx); err != nil {
				log.Error().Err(err).Msg("scheduled SC Wiki sync failed")
			}

			// Run image sync after SC Wiki sync so vehicles exist
			log.Info().Msg("scheduled FleetYards image sync starting")
			if err := s.syncImages(ctx); err != nil {
				log.Error().Err(err).Msg("scheduled FleetYards image sync failed")
			}

			// Run paint sync after images
			log.Info().Msg("scheduled paint sync starting")
			if err := s.syncPaints(ctx); err != nil {
				log.Error().Err(err).Msg("scheduled paint sync failed")
			}

			// RSI API sync — overwrites FleetYards with RSI CDN URLs
			if s.rsiAPI != nil {
				log.Info().Msg("scheduled RSI API image sync starting")
				if err := s.syncRSIAPI(ctx); err != nil {
					log.Error().Err(err).Msg("scheduled RSI API image sync failed")
				}
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
			s.syncMu.Lock()
			defer s.syncMu.Unlock()

			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()

			// SC Wiki sync is the primary data source — run first
			if s.scwiki != nil {
				mfgCount, _ := s.db.GetManufacturerCount(ctx)
				if mfgCount == 0 {
					log.Info().Msg("no manufacturers in database, running SC Wiki startup sync")
					if err := s.syncSCWiki(ctx); err != nil {
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
				if err := s.syncImages(ctx); err != nil {
					log.Error().Err(err).Msg("startup FleetYards image sync failed")
				}

				// Paint sync — runs after images so vehicles exist
				log.Info().Msg("running startup paint sync")
				if err := s.syncPaints(ctx); err != nil {
					log.Error().Err(err).Msg("startup paint sync failed")
				}

				// RSI API sync — overwrites FleetYards with RSI CDN URLs
				if s.rsiAPI != nil {
					log.Info().Msg("running startup RSI API image sync")
					if err := s.syncRSIAPI(ctx); err != nil {
						log.Error().Err(err).Msg("startup RSI API image sync failed")
					}
				}

				// RSI extract image import — static fallback when API not enabled
				if s.rsiAPI == nil && s.cfg.RSIExtractPath != "" {
					log.Info().Str("path", s.cfg.RSIExtractPath).Msg("running RSI extract image import (API not enabled, using static fallback)")
					if err := rsi.ImportImages(ctx, s.db, s.cfg.RSIExtractPath); err != nil {
						log.Error().Err(err).Msg("RSI extract image import failed")
					}
				}
			} else {
				log.Warn().Msg("no vehicles in database after SC Wiki sync, skipping image and paint sync")
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

// --- Exported methods for manual triggers (acquire lock, skip if busy) ---

// SyncImages fetches store images from FleetYards and updates the image columns on existing vehicles.
// This is an image-only sync — all other ship data comes from SC Wiki.
func (s *Scheduler) SyncImages(ctx context.Context) error {
	if !s.syncMu.TryLock() {
		return fmt.Errorf("sync already in progress")
	}
	defer s.syncMu.Unlock()
	return s.syncImages(ctx)
}

// SyncPaints runs the full paint sync pipeline.
func (s *Scheduler) SyncPaints(ctx context.Context) error {
	if !s.syncMu.TryLock() {
		return fmt.Errorf("sync already in progress")
	}
	defer s.syncMu.Unlock()
	return s.syncPaints(ctx)
}

// SyncRSIAPI fetches ship and paint images from the RSI API.
func (s *Scheduler) SyncRSIAPI(ctx context.Context) error {
	if !s.syncMu.TryLock() {
		return fmt.Errorf("sync already in progress")
	}
	defer s.syncMu.Unlock()
	return s.syncRSIAPI(ctx)
}

// SyncSCWiki syncs Star Citizen data from SC Wiki API.
func (s *Scheduler) SyncSCWiki(ctx context.Context) error {
	if !s.syncMu.TryLock() {
		return fmt.Errorf("sync already in progress")
	}
	defer s.syncMu.Unlock()
	return s.syncSCWiki(ctx)
}

// --- Internal methods (caller must hold syncMu) ---

func (s *Scheduler) syncImages(ctx context.Context) error {
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

func (s *Scheduler) syncPaints(ctx context.Context) error {
	// Step 1: scunpacked metadata sync
	if s.scunpacked != nil {
		log.Info().Msg("scunpacked paint metadata sync starting")
		count, err := s.scunpacked.SyncPaints(ctx)
		if err != nil {
			log.Error().Err(err).Msg("scunpacked paint sync failed")
		} else {
			log.Info().Int("count", count).Msg("scunpacked paint metadata sync complete")
		}
	}

	// Step 2: Fetch paint images from FleetYards
	slugs, err := s.db.GetVehicleSlugsWithPaints(ctx)
	if err != nil {
		log.Warn().Err(err).Msg("failed to get vehicle slugs with paints")
		return nil
	}

	if len(slugs) == 0 {
		log.Info().Msg("no vehicles with paints to fetch images for")
		return nil
	}

	log.Info().Int("vehicles", len(slugs)).Msg("fetching paint images from FleetYards")
	imagesSynced := 0

	for _, vehicleSlug := range slugs {
		fyPaints, err := s.client.FetchPaintImages(ctx, vehicleSlug)
		if err != nil {
			log.Debug().Err(err).Str("vehicle", vehicleSlug).Msg("no FleetYards paints for vehicle")
			continue
		}

		if len(fyPaints) == 0 {
			continue
		}

		// Get DB paints for this vehicle to match by name
		dbPaints, err := s.db.GetPaintsByVehicleSlug(ctx, vehicleSlug)
		if err != nil {
			log.Warn().Err(err).Str("vehicle", vehicleSlug).Msg("failed to get DB paints for matching")
			continue
		}

		for _, fyPaint := range fyPaints {
			matched := matchPaintByName(fyPaint, dbPaints)
			if matched == nil {
				continue
			}

			if err := s.db.UpdatePaintImages(ctx, matched.ClassName,
				fyPaint.ImageURL, fyPaint.ImageURLSmall,
				fyPaint.ImageURLMedium, fyPaint.ImageURLLarge); err != nil {
				log.Warn().Err(err).Str("paint", matched.ClassName).Msg("failed to update paint images")
				continue
			}
			imagesSynced++
		}

		// Rate limit FleetYards requests
		time.Sleep(500 * time.Millisecond)
	}

	log.Info().Int("images_synced", imagesSynced).Msg("FleetYards paint image sync complete")
	return nil
}

// matchPaintByName tries to match a FleetYards paint to a DB paint by normalizing names.
func matchPaintByName(fyPaint fleetyards.PaintImages, dbPaints []models.Paint) *models.Paint {
	fyNorm := normalizePaintName(fyPaint.Name)

	for i := range dbPaints {
		dbNorm := normalizePaintName(dbPaints[i].Name)

		// Try exact normalized match
		if fyNorm == dbNorm {
			return &dbPaints[i]
		}

		// Try substring match (FY name in DB name or vice versa)
		if strings.Contains(dbNorm, fyNorm) || strings.Contains(fyNorm, dbNorm) {
			return &dbPaints[i]
		}
	}

	return nil
}

// normalizePaintName strips common prefixes/suffixes and lowercases for comparison.
func normalizePaintName(name string) string {
	n := strings.ToLower(name)
	n = strings.TrimSpace(n)
	// Remove common suffixes like "livery", "paint", "skin"
	n = strings.TrimSuffix(n, " livery")
	n = strings.TrimSuffix(n, " paint")
	n = strings.TrimSuffix(n, " skin")
	return n
}

func (s *Scheduler) syncRSIAPI(ctx context.Context) error {
	if s.rsiAPI == nil {
		return fmt.Errorf("RSI API sync not enabled (set RSI_API_ENABLED=true)")
	}

	log.Info().Msg("RSI API image sync starting")
	if err := s.rsiAPI.SyncAll(ctx); err != nil {
		return fmt.Errorf("RSI API sync failed: %w", err)
	}

	log.Info().Msg("RSI API image sync complete")
	return nil
}

func (s *Scheduler) syncSCWiki(ctx context.Context) error {
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
