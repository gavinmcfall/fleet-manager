// +build ignore

package main

import (
	"context"
	"database/sql"
	"log"

	"github.com/nzvengeance/fleet-manager/internal/scwiki"
	_ "github.com/mattn/go-sqlite3"
)

func main() {
	// Connect to database
	db, err := sql.Open("sqlite3", "./data/fleet-manager.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Create V2 sync client
	repoPath := "/home/gavin/cloned-repos/StarCitizenWiki/scunpacked-data"
	client := scwiki.NewSyncClientV2(db, "sqlite", repoPath)

	// Run sync
	ctx := context.Background()
	log.Println("Starting V2 sync...")

	if err := client.SyncAll(ctx); err != nil {
		log.Fatalf("Sync failed: %v", err)
	}

	log.Println("Sync complete!")

	// Query some stats
	var manufacturerCount, vehicleCount, portCount, itemCount int
	db.QueryRow("SELECT COUNT(*) FROM manufacturers").Scan(&manufacturerCount)
	db.QueryRow("SELECT COUNT(*) FROM sc_vehicles_v2").Scan(&vehicleCount)
	db.QueryRow("SELECT COUNT(*) FROM sc_ports").Scan(&portCount)
	db.QueryRow("SELECT COUNT(*) FROM sc_items_v2").Scan(&itemCount)

	log.Printf("Results:")
	log.Printf("  Manufacturers: %d", manufacturerCount)
	log.Printf("  Vehicles: %d", vehicleCount)
	log.Printf("  Ports: %d", portCount)
	log.Printf("  Items: %d", itemCount)
}
