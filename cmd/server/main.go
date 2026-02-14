package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nzvengeance/fleet-manager/internal/api"
	"github.com/nzvengeance/fleet-manager/internal/config"
	"github.com/nzvengeance/fleet-manager/internal/crypto"
	"github.com/nzvengeance/fleet-manager/internal/database"
	"github.com/nzvengeance/fleet-manager/internal/fleetyards"
	syncsvc "github.com/nzvengeance/fleet-manager/internal/sync"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// Setup logging
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339})

	log.Info().Msg("Fleet Manager starting up")

	// Initialize encryption
	encKey := os.Getenv("ENCRYPTION_KEY")
	if encKey == "" {
		// Check if we're in production mode
		if os.Getenv("DATABASE_URL") != "" || os.Getenv("ENVIRONMENT") == "production" {
			log.Fatal().Msg("ENCRYPTION_KEY must be set in production - generate with: openssl rand -base64 32")
		}
		log.Warn().Msg("ENCRYPTION_KEY not set - generating random key (development only)")
	}
	if err := crypto.InitEncryption(encKey); err != nil {
		log.Fatal().Err(err).Msg("failed to initialize encryption")
	}

	// Load config
	cfg := config.Load()

	// Connect database
	db, err := database.New(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer db.Close()

	// Create FleetYards client
	fyClient := fleetyards.NewClient(cfg.FleetYardsBaseURL)

	// Create sync scheduler
	scheduler := syncsvc.NewScheduler(db, fyClient, cfg)
	if err := scheduler.Start(); err != nil {
		log.Fatal().Err(err).Msg("failed to start scheduler")
	}
	defer scheduler.Stop()

	// Create API server
	srv := api.NewServer(db, cfg, scheduler)

	httpServer := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      srv.Router(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 5 * time.Minute, // Increased for LLM AI analysis operations
		IdleTimeout:  60 * time.Second,
	}

	// Start server
	go func() {
		log.Info().Str("port", cfg.Port).Msg("HTTP server listening")
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("server error")
		}
	}()

	// Wait for shutdown signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("shutting down gracefully")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("server shutdown error")
	}

	log.Info().Msg("Fleet Manager stopped")
}
