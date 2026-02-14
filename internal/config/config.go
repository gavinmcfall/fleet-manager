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

	// SC Wiki API sync
	SCWikiEnabled   bool
	SCWikiRateLimit float64 // requests per second
	SCWikiBurst     int     // burst size

	// SC Wiki V2 (scunpacked-data repo)
	SCDataRepoPath string // path to scunpacked-data repository

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
		SCWikiEnabled:     getEnvBool("SC_WIKI_ENABLED", true),
		SCWikiRateLimit:   getEnvFloat("SC_WIKI_RATE_LIMIT", 1.0),
		SCWikiBurst:       getEnvInt("SC_WIKI_BURST", 5),
		SCDataRepoPath:    getEnv("SC_DATA_REPO_PATH", ""),
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

func getEnvFloat(key string, fallback float64) float64 {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	f, err := strconv.ParseFloat(val, 64)
	if err != nil {
		return fallback
	}
	return f
}

func getEnvInt(key string, fallback int) int {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	i, err := strconv.Atoi(val)
	if err != nil {
		return fallback
	}
	return i
}
