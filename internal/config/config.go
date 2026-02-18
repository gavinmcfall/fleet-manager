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

	// FleetYards (images only)
	FleetYardsBaseURL string

	// SC Wiki API sync
	SCWikiEnabled   bool
	SCWikiRateLimit float64 // requests per second
	SCWikiBurst     int     // burst size

	// Sync
	SyncSchedule  string // cron expression
	SyncOnStartup bool

	// scunpacked-data (paint metadata)
	ScunpackedDataPath string

	// RSI extract images (one-time seed from pledge store/ship matrix extracts)
	RSIExtractPath string

	// RSI API (live ship + paint images from RSI CDN)
	RSIAPIEnabled bool
	RSIBaseURL    string
	RSIRateLimit  float64

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
		SCWikiEnabled:     getEnvBool("SC_WIKI_ENABLED", true),
		SCWikiRateLimit:   getEnvFloat("SC_WIKI_RATE_LIMIT", 1.0),
		SCWikiBurst:       getEnvInt("SC_WIKI_BURST", 5),
		SyncSchedule:      getEnv("SYNC_SCHEDULE", "0 3 * * *"), // 3am daily
		SyncOnStartup:     getEnvBool("SYNC_ON_STARTUP", true),
		ScunpackedDataPath: getEnv("SCUNPACKED_DATA_PATH", ""),
		RSIExtractPath:     getEnv("RSI_EXTRACT_PATH", ""),
		RSIAPIEnabled:      getEnvBool("RSI_API_ENABLED", false),
		RSIBaseURL:         getEnv("RSI_BASE_URL", "https://robertsspaceindustries.com"),
		RSIRateLimit:       getEnvFloat("RSI_RATE_LIMIT", 1.0),
		StaticDir:          getEnv("STATIC_DIR", "./frontend/dist"),
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
