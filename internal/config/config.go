package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	// Server
	Port    string
	BaseURL string

	// Database
	DBDriver string // "sqlite" or "postgres"
	DBPath   string // SQLite file path
	DBURL    string // PostgreSQL connection string

	// FleetYards
	FleetYardsBaseURL string
	FleetYardsUser    string

	// Sync
	SyncSchedule  string // cron expression
	SyncOnStartup bool

	// Frontend
	StaticDir string
}

func Load() *Config {
	return &Config{
		Port:              getEnv("PORT", "8080"),
		BaseURL:           getEnv("BASE_URL", "http://localhost:8080"),
		DBDriver:          getEnv("DB_DRIVER", "sqlite"),
		DBPath:            getEnv("DB_PATH", "./data/fleet-manager.db"),
		DBURL:             getEnv("DATABASE_URL", ""),
		FleetYardsBaseURL: getEnv("FLEETYARDS_BASE_URL", "https://api.fleetyards.net"),
		FleetYardsUser:    getEnv("FLEETYARDS_USER", ""),
		SyncSchedule:      getEnv("SYNC_SCHEDULE", "0 3 * * *"), // 3am daily
		SyncOnStartup:     getEnvBool("SYNC_ON_STARTUP", true),
		StaticDir:         getEnv("STATIC_DIR", "./frontend/dist"),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	val = strings.ToLower(val)
	b, err := strconv.ParseBool(val)
	if err != nil {
		return fallback
	}
	return b
}
