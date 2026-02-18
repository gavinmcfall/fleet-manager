import { Hono } from "hono";
import type { Env, HangarXplorEntry } from "../lib/types";
import { slugFromShipCode, slugFromName, compactSlug } from "../lib/slug";

/**
 * /api/import/* — HangarXplor import
 */
export function importRoutes<E extends { Bindings: Env }>() {
  const routes = new Hono<E>();

  // POST /api/import/hangarxplor — import HangarXplor JSON export
  routes.post("/hangarxplor", async (c) => {
    const db = c.env.DB;

    const entries: HangarXplorEntry[] = await c.req.json();
    if (!Array.isArray(entries)) {
      return c.json({ error: "Expected JSON array" }, 400);
    }

    // Get default user ID
    const userRow = await db
      .prepare("SELECT id FROM users WHERE username = 'default'")
      .first<{ id: number }>();
    if (!userRow) {
      return c.json({ error: "Default user not found" }, 500);
    }
    const userID = userRow.id;

    // Resolve insurance type IDs
    const insuranceMap = await loadInsuranceTypes(db);

    // Clean slate — delete existing fleet
    await db.prepare("DELETE FROM user_fleet WHERE user_id = ?").bind(userID).run();

    let imported = 0;
    for (const entry of entries) {
      const displayName = entry.name;

      // Generate slug candidates
      const codeSlug = slugFromShipCode(entry.ship_code);
      const nameSlug = slugFromName(displayName);
      const lookupSlug = entry.lookup ? slugFromName(entry.lookup) : "";
      const compactCode = compactSlug(codeSlug);
      const compactName = compactSlug(nameSlug);

      // Find matching vehicle in reference table
      const candidates = [codeSlug, nameSlug, lookupSlug, compactCode, compactName];
      let matchedSlug = await findVehicleSlug(db, candidates, displayName);
      if (!matchedSlug) {
        matchedSlug = codeSlug;
      }

      // Resolve vehicle ID from reference table
      let vehicleID = await getVehicleIDBySlug(db, matchedSlug);
      if (vehicleID === null) {
        // Vehicle not in reference DB — create a stub entry
        const result = await db
          .prepare(
            `INSERT INTO vehicles (slug, name, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(slug) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at`,
          )
          .bind(matchedSlug, displayName)
          .run();

        // Get the ID of the inserted/updated row
        if (result.meta.last_row_id) {
          vehicleID = result.meta.last_row_id;
        } else {
          const row = await db
            .prepare("SELECT id FROM vehicles WHERE slug = ?")
            .bind(matchedSlug)
            .first<{ id: number }>();
          vehicleID = row?.id ?? null;
        }

        if (vehicleID === null) {
          console.warn(`[import] Failed to create stub vehicle: ${displayName} (${matchedSlug})`);
          continue;
        }
      }

      // Detect custom name
      let customName = "";
      if (entry.ship_name) {
        const snLower = entry.ship_name.toLowerCase();
        const codeLower = entry.ship_code.toLowerCase();
        const nameLower = displayName.toLowerCase();
        let isCustom = true;
        if (codeLower.includes(slugFromName(entry.ship_name).toLowerCase())) {
          isCustom = false;
        }
        if (nameLower.includes(snLower) || snLower.includes(nameLower)) {
          isCustom = false;
        }
        if (isCustom) {
          customName = entry.ship_name;
        }
      }

      // Determine insurance type
      let insuranceTypeID: number | null = null;
      if (entry.lti) {
        insuranceTypeID = insuranceMap.get("lti") ?? null;
      } else {
        const insLower = (entry.insurance ?? "").toLowerCase();
        if (insLower.includes("120")) {
          insuranceTypeID = insuranceMap.get("120_month") ?? null;
        } else if (insLower.includes("72")) {
          insuranceTypeID = insuranceMap.get("72_month") ?? null;
        } else if (insLower.includes("6 month") || insLower.includes("6-month")) {
          insuranceTypeID = insuranceMap.get("6_month") ?? null;
        } else if (insLower.includes("3 month") || insLower.includes("3-month")) {
          insuranceTypeID = insuranceMap.get("3_month") ?? null;
        } else if (insLower.includes("standard")) {
          insuranceTypeID = insuranceMap.get("standard") ?? null;
        } else {
          insuranceTypeID = insuranceMap.get("unknown") ?? null;
        }
      }

      // Insert user fleet entry
      try {
        await db
          .prepare(
            `INSERT INTO user_fleet (user_id, vehicle_id, insurance_type_id, warbond, is_loaner,
              pledge_id, pledge_name, pledge_cost, pledge_date, custom_name, imported_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          )
          .bind(
            userID,
            vehicleID,
            insuranceTypeID,
            entry.warbond ? 1 : 0,
            0, // is_loaner
            entry.pledge_id || null,
            entry.pledge_name || null,
            entry.pledge_cost || null,
            entry.pledge_date || null,
            customName || null,
          )
          .run();
        imported++;
      } catch (err) {
        console.warn(`[import] Failed to insert fleet entry: ${displayName}`, err);
      }
    }

    console.log(`[import] HangarXplor import complete: ${imported}/${entries.length}`);
    return c.json({
      imported,
      total: entries.length,
      message: "Import complete",
    });
  });

  return routes;
}

async function loadInsuranceTypes(db: D1Database): Promise<Map<string, number>> {
  const result = await db.prepare("SELECT id, key FROM insurance_types").all();
  const map = new Map<string, number>();
  for (const row of result.results) {
    const r = row as { id: number; key: string };
    map.set(r.key, r.id);
  }
  return map;
}

async function getVehicleIDBySlug(db: D1Database, slug: string): Promise<number | null> {
  const row = await db
    .prepare("SELECT id FROM vehicles WHERE slug = ? LIMIT 1")
    .bind(slug)
    .first<{ id: number }>();
  return row?.id ?? null;
}

async function findVehicleSlug(
  db: D1Database,
  candidateSlugs: string[],
  displayName: string,
): Promise<string | null> {
  // Try exact slug matches
  for (const slug of candidateSlugs) {
    if (!slug) continue;
    const row = await db
      .prepare("SELECT slug FROM vehicles WHERE slug = ? LIMIT 1")
      .bind(slug)
      .first<{ slug: string }>();
    if (row) return row.slug;
  }

  // Try name match
  if (displayName) {
    const row = await db
      .prepare("SELECT slug FROM vehicles WHERE LOWER(name) = LOWER(?) LIMIT 1")
      .bind(displayName)
      .first<{ slug: string }>();
    if (row) return row.slug;
  }

  // Try prefix match
  for (const slug of candidateSlugs) {
    if (!slug || slug.length < 3) continue;
    const row = await db
      .prepare("SELECT slug FROM vehicles WHERE slug LIKE ? LIMIT 1")
      .bind(slug + "%")
      .first<{ slug: string }>();
    if (row) return row.slug;
  }

  return null;
}
