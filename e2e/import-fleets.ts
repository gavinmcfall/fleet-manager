#!/usr/bin/env tsx
/**
 * Import fleet data for each test persona directly via D1 SQL.
 * Bypasses the import API entirely — resolves vehicle slugs and inserts into user_fleet.
 *
 * Usage: source ~/.secrets && npx tsx e2e/import-fleets.ts
 *
 * Idempotent — deletes existing fleet data before importing.
 */
import { execSync } from "child_process";
import { PERSONAS } from "../test/fixtures/personas";

interface FleetEntry {
  ship_code: string;
  manufacturer_code: string;
  manufacturer_name: string;
  name: string;
  lti: boolean;
  insurance?: string;
  warbond: boolean;
  pledge_id: string;
  pledge_name: string;
  pledge_date: string;
  pledge_cost: string;
  entity_type: string;
  ship_name?: string;
  lookup?: string;
  unidentified?: string;
}

function d1Execute(sql: string): string {
  const escaped = sql.replace(/'/g, "'\\''");
  return execSync(
    `. ~/.secrets && npx wrangler d1 execute sc-companion --remote --command '${escaped}' --json`,
    { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024, shell: "/bin/bash" },
  );
}

function d1Query<T = Record<string, unknown>>(sql: string): T[] {
  const raw = d1Execute(sql);
  const parsed = JSON.parse(raw);
  return parsed[0]?.results ?? [];
}

function escSql(val: string | null | undefined): string {
  if (val == null) return "NULL";
  return `'${val.replace(/'/g, "''")}'`;
}

// Load insurance type map from DB
function loadInsuranceTypes(): Map<string, number> {
  const rows = d1Query<{ id: number; key: string }>(
    `SELECT id, key FROM insurance_types`,
  );
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.key, r.id);
  return map;
}

// Load vehicle slug -> id map
function loadVehicleMap(): Map<string, number> {
  const rows = d1Query<{ id: number; slug: string }>(
    `SELECT id, slug FROM vehicles WHERE game_version_id = (SELECT game_version_id FROM vehicles GROUP BY game_version_id ORDER BY COUNT(*) DESC LIMIT 1)`,
  );
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.slug, r.id);
  return map;
}

// Convert ship_code to slug: "RSI_Aurora_MR" -> "rsi-aurora-mr"
function shipCodeToSlug(code: string): string {
  return code.toLowerCase().replace(/_/g, "-");
}

// Determine insurance type id from entry
function resolveInsuranceTypeId(
  entry: FleetEntry,
  insuranceMap: Map<string, number>,
): number | null {
  if (entry.lti) return insuranceMap.get("lti") ?? null;
  const ins = (entry.insurance ?? "").toLowerCase();
  if (ins.includes("120")) return insuranceMap.get("120_month") ?? null;
  if (ins.includes("72")) return insuranceMap.get("72_month") ?? null;
  if (ins.includes("6 month") || ins.includes("6-month")) return insuranceMap.get("6_month") ?? null;
  if (ins.includes("3 month") || ins.includes("3-month")) return insuranceMap.get("3_month") ?? null;
  if (ins.includes("standard")) return insuranceMap.get("standard") ?? null;
  return insuranceMap.get("unknown") ?? null;
}

// Detect custom name (same logic as import route)
function detectCustomName(entry: FleetEntry): string | null {
  if (!entry.ship_name) return null;
  const snLower = entry.ship_name.toLowerCase();
  const codeLower = entry.ship_code.toLowerCase();
  const nameLower = entry.name.toLowerCase();
  // If ship_name matches ship_code or display name, it's not custom
  if (codeLower.includes(snLower.replace(/[^a-z0-9]/g, "")) ||
      nameLower.includes(snLower) || snLower.includes(nameLower)) {
    return null;
  }
  return entry.ship_name;
}

async function main() {
  console.log("=== SC Bridge Fleet Import (via D1) ===\n");

  const insuranceMap = loadInsuranceTypes();
  console.log(`Loaded ${insuranceMap.size} insurance types`);

  const vehicleMap = loadVehicleMap();
  console.log(`Loaded ${vehicleMap.size} vehicles\n`);

  for (const [key, persona] of Object.entries(PERSONAS)) {
    if (key === "empty" || !persona.fleetFile) {
      console.log(`[${key}] No fleet to import`);
      continue;
    }

    console.log(`[${key}] Importing fleet for ${persona.email}...`);

    // Get user ID
    const users = d1Query<{ id: string }>(
      `SELECT id FROM "user" WHERE email = '${persona.email}'`,
    );
    if (users.length === 0) {
      console.log(`  User not found — skipping`);
      continue;
    }
    const userId = users[0].id;

    // Load fleet data
    const mod = await import(`../test/fixtures/${persona.fleetFile}`);
    const entries: FleetEntry[] = mod.default;

    // Delete existing fleet for this user
    d1Execute(`DELETE FROM user_fleet WHERE user_id = '${userId}'`);

    // Insert fleet entries in batches (D1 has statement size limits)
    let imported = 0;
    let stubsCreated = 0;

    for (const entry of entries) {
      const slug = shipCodeToSlug(entry.ship_code);
      let vehicleId = vehicleMap.get(slug);

      if (!vehicleId) {
        // Try partial match — some slugs differ slightly
        for (const [existingSlug, id] of vehicleMap) {
          if (existingSlug.startsWith(slug) || slug.startsWith(existingSlug)) {
            vehicleId = id;
            break;
          }
        }
      }

      if (!vehicleId) {
        // Create stub vehicle
        d1Execute(
          `INSERT INTO vehicles (slug, name, game_version_id, updated_at)
           VALUES ('${slug}', ${escSql(entry.name)}, (SELECT game_version_id FROM vehicles GROUP BY game_version_id ORDER BY COUNT(*) DESC LIMIT 1), datetime('now'))
           ON CONFLICT(slug) DO UPDATE SET name=excluded.name`,
        );
        // Get the new ID
        const newVehicle = d1Query<{ id: number }>(
          `SELECT id FROM vehicles WHERE slug = '${slug}' ORDER BY id DESC LIMIT 1`,
        );
        if (newVehicle.length > 0) {
          vehicleId = newVehicle[0].id;
          vehicleMap.set(slug, vehicleId);
          stubsCreated++;
          // Also insert into vehicle_images
          d1Execute(`INSERT OR IGNORE INTO vehicle_images (vehicle_id) VALUES (${vehicleId})`);
        }
      }

      if (!vehicleId) {
        console.log(`  Warning: Could not resolve vehicle for ${entry.ship_code}`);
        continue;
      }

      const insTypeId = resolveInsuranceTypeId(entry, insuranceMap);
      const customName = detectCustomName(entry);

      d1Execute(
        `INSERT INTO user_fleet (user_id, vehicle_id, insurance_type_id, warbond, is_loaner,
           pledge_id, pledge_name, pledge_cost, pledge_date, custom_name, imported_at)
         VALUES ('${userId}', ${vehicleId}, ${insTypeId ?? "NULL"}, ${entry.warbond ? 1 : 0}, 0,
           ${escSql(entry.pledge_id)}, ${escSql(entry.pledge_name)}, ${escSql(entry.pledge_cost)},
           ${escSql(entry.pledge_date)}, ${escSql(customName)}, datetime('now'))`,
      );
      imported++;
    }

    console.log(`  Imported ${imported}/${entries.length} ships${stubsCreated > 0 ? ` (${stubsCreated} stub vehicles created)` : ""}`);
  }

  console.log("\n=== Fleet Import Complete ===");
}

main().catch((err) => {
  console.error("\nImport failed:", err);
  process.exit(1);
});
