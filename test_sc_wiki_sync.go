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
	db, err := sql.Open("sqlite3", "./data/fleet-manager.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	client := scwiki.NewClient(1.0, 5) // 1 req/sec, burst 5
	syncer := scwiki.NewSyncer(client, db, "sqlite")

	ctx := context.Background()

	log.Println("Testing manufacturer sync...")
	if err := syncer.SyncManufacturers(ctx); err != nil {
		log.Fatalf("Manufacturer sync failed: %v", err)
	}

	// Query results
	var count int
	db.QueryRow("SELECT COUNT(*) FROM manufacturers").Scan(&count)
	log.Printf("Manufacturers synced: %d", count)

	log.Println("Testing vehicle sync...")
	if err := syncer.SyncVehicles(ctx); err != nil {
		log.Fatalf("Vehicle sync failed: %v", err)
	}

	db.QueryRow("SELECT COUNT(*) FROM sc_vehicles_v2").Scan(&count)
	log.Printf("Vehicles synced: %d", count)

	db.QueryRow("SELECT COUNT(*) FROM sc_ports").Scan(&count)
	log.Printf("Ports synced: %d", count)

	log.Println("Testing item sync...")
	if err := syncer.SyncItems(ctx); err != nil {
		log.Fatalf("Item sync failed: %v", err)
	}

	db.QueryRow("SELECT COUNT(*) FROM sc_items_v2").Scan(&count)
	log.Printf("Items synced: %d", count)

	log.Println("\nSync metadata:")
	rows, _ := db.Query("SELECT endpoint, sync_status, total_records FROM sc_sync_metadata")
	defer rows.Close()
	for rows.Next() {
		var endpoint, status string
		var count int
		rows.Scan(&endpoint, &status, &count)
		log.Printf("  %s: %s (%d records)", endpoint, status, count)
	}
}
