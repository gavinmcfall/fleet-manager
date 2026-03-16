import { Hono } from "hono";
import type { HonoEnv, HangarXplorEntry } from "../lib/types";
import { getAuthUser } from "../lib/types";
import { slugFromShipCode, slugFromName, compactSlug } from "../lib/slug";
import { loadInsuranceTypes } from "../db/queries";
import { logEvent } from "../lib/logger";
import { logUserChange } from "../lib/change-history";
import { validate, HangarXplorImportSchema, HangarSyncPayloadSchema } from "../lib/validation";
import { VEHICLE_VERSION_CAP } from "../lib/constants";
import {
  preloadVehicleMap,
  findVehicleSlugLocal,
  executeFleetSwap,
} from "../lib/fleet-import";

/**
 * /api/import/* — HangarXplor import + hangar-sync extension
 *
 * Preloads vehicle slug map to avoid per-entry DB queries.
 * Uses db.batch() for transactional delete+insert (all-or-nothing).
 */
export function importRoutes() {
  const routes = new Hono<HonoEnv>();

  // POST /api/import/hangarxplor — import HangarXplor JSON export
  routes.post("/hangarxplor", validate("json", HangarXplorImportSchema), async (c) => {
    const db = c.env.DB;
    const userID = c.get("user")!.id;

    const entries: HangarXplorEntry[] = c.req.valid("json");

    // Preload all vehicle slugs+names into memory (avoids per-entry queries)
    const vehicleMap = await preloadVehicleMap(db);
    const insuranceMap = await loadInsuranceTypes(db);

    // Build all insert statements first, then batch with the delete
    const insertStmts: D1PreparedStatement[] = [];
    let stubStmts: D1PreparedStatement[] = [];
    const stubSlugs: string[] = [];

    for (const entry of entries) {
      const displayName = entry.name;

      // Generate slug candidates
      const codeSlug = slugFromShipCode(entry.ship_code);
      const nameSlug = slugFromName(displayName);
      const lookupSlug = entry.lookup ? slugFromName(entry.lookup) : "";
      const compactCode = compactSlug(codeSlug);
      const compactName = compactSlug(nameSlug);

      // Find matching vehicle in preloaded map
      const candidates = [codeSlug, nameSlug, lookupSlug, compactCode, compactName];
      let matchedSlug = findVehicleSlugLocal(vehicleMap, candidates, displayName);
      if (!matchedSlug) {
        matchedSlug = codeSlug;
        // Need to create a stub — queue for batch insert
        if (!vehicleMap.slugToID.has(matchedSlug)) {
          stubStmts.push(
            db
              .prepare(
                `INSERT INTO vehicles (slug, name, game_version_id, updated_at)
                VALUES (?, ?, (SELECT id FROM game_versions WHERE is_default = 1), datetime('now'))
                ON CONFLICT(slug, game_version_id) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at`,
              )
              .bind(matchedSlug, displayName),
          );
          stubSlugs.push(matchedSlug);
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

      // Queue insert (vehicleID resolved after stubs are created)
      insertStmts.push(
        db
          .prepare(
            `INSERT INTO user_fleet (user_id, vehicle_id, insurance_type_id, warbond, is_loaner,
              pledge_id, pledge_name, pledge_cost, pledge_date, custom_name, imported_at)
            VALUES (?, (SELECT id FROM vehicles WHERE slug = ? AND ${VEHICLE_VERSION_CAP} ORDER BY game_version_id DESC LIMIT 1), ?, ?, ?,
              ?, ?, ?, ?, ?, datetime('now'))`,
          )
          .bind(
            userID,
            matchedSlug,
            insuranceTypeID,
            entry.warbond ? 1 : 0,
            0,
            entry.pledge_id || null,
            entry.pledge_name || null,
            entry.pledge_cost || null,
            entry.pledge_date || null,
            customName || null,
          ),
      );
    }

    // Execute: stubs first (if any), then delete+insert as a batch
    if (stubStmts.length > 0) {
      // Batch stub vehicle creation (max 100 per batch for D1)
      for (let i = 0; i < stubStmts.length; i += 100) {
        await db.batch(stubStmts.slice(i, i + 100));
      }
      console.log(`[import] Created ${stubStmts.length} stub vehicles: ${stubSlugs.join(", ")}`);
    }

    // Insert-then-swap using shared helper
    await executeFleetSwap(db, userID, insertStmts);
    const imported = insertStmts.length;

    console.log(`[import] HangarXplor import complete: ${imported}/${entries.length}`);
    logEvent("fleet_import", {
      entries: entries.length,
      imported,
      stubs_created: stubStmts.length,
      stub_slugs: stubSlugs,
    });
    await logUserChange(db, userID, "fleet_imported", {
      metadata: { vehicle_count: imported, total_entries: entries.length },
      ipAddress: c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for"),
    });
    return c.json({
      imported,
      total: entries.length,
      message: "Import complete",
    });
  });

  // POST /api/import/hangar-sync — import from SC Bridge extension (RSI hangar sync)
  routes.post("/hangar-sync", validate("json", HangarSyncPayloadSchema), async (c) => {
   try {
    const db = c.env.DB;
    const userID = getAuthUser(c).id;

    const payload = c.req.valid("json");

    // Rate limit: reject if synced within last 5 minutes
    const existingProfile = await db
      .prepare("SELECT synced_at FROM user_rsi_profiles WHERE user_id = ?")
      .bind(userID)
      .first<{ synced_at: string }>();
    if (existingProfile) {
      const lastSync = new Date(existingProfile.synced_at + "Z").getTime();
      const now = Date.now();
      if (now - lastSync < 5 * 60 * 1000) {
        return c.json({ error: "Sync rate limited — please wait 5 minutes between syncs" }, 429);
      }
    }

    // --- Fleet import ---
    const vehicleMap = await preloadVehicleMap(db);
    const insuranceMap = await loadInsuranceTypes(db);

    const insertStmts: D1PreparedStatement[] = [];
    const stubStmts: D1PreparedStatement[] = [];
    const stubSlugs: string[] = [];

    for (const pledge of payload.pledges) {
      const shipItems = pledge.items.filter((item) => item.kind === "Ship");

      for (const item of shipItems) {
        const displayName = item.title;

        // Generate slug candidates from item title and manufacturer code
        const nameSlug = slugFromName(displayName);
        const codeSlug = item.manufacturerCode
          ? slugFromShipCode(`${item.manufacturerCode}_${displayName.replace(/\s+/g, "_")}`)
          : nameSlug;
        const compactCode = compactSlug(codeSlug);
        const compactName = compactSlug(nameSlug);

        const candidates = [codeSlug, nameSlug, compactCode, compactName];
        let matchedSlug = findVehicleSlugLocal(vehicleMap, candidates, displayName);
        if (!matchedSlug) {
          matchedSlug = codeSlug;
          if (!vehicleMap.slugToID.has(matchedSlug)) {
            stubStmts.push(
              db
                .prepare(
                  `INSERT INTO vehicles (slug, name, game_version_id, updated_at)
                  VALUES (?, ?, (SELECT id FROM game_versions WHERE is_default = 1), datetime('now'))
                  ON CONFLICT(slug, game_version_id) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at`,
                )
                .bind(matchedSlug, displayName),
            );
            stubSlugs.push(matchedSlug);
            // Add to map so we don't create duplicate stubs
            vehicleMap.slugToID.set(matchedSlug, -1);
          }
        }

        // Insurance: parse from pledge items with kind=Insurance
        // Titles are like "Lifetime Insurance", "120 Month Insurance", "6 Month Insurance"
        let insuranceTypeID: number | null = null;
        const insuranceItem = pledge.items.find(
          (i: { kind?: string | null; title?: string }) => i.kind === "Insurance",
        );
        const insTitle = (insuranceItem?.title ?? "").toLowerCase();
        if (pledge.hasLti || insTitle.includes("lifetime") || insTitle.includes("lti")) {
          insuranceTypeID = insuranceMap.get("lti") ?? null;
        } else if (insTitle) {
          // Parse "N Month Insurance" → N_month key
          const monthMatch = insTitle.match(/(\d+)\s*month/);
          if (monthMatch) {
            insuranceTypeID = insuranceMap.get(`${monthMatch[1]}_month`) ?? insuranceMap.get("unknown") ?? null;
          } else {
            insuranceTypeID = insuranceMap.get("unknown") ?? null;
          }
        } else {
          // No insurance item in pledge — no insurance
          insuranceTypeID = null;
        }

        // Custom name from extension data
        const customName = item.customName || null;

        // Format pledge cost from cents
        const pledgeCost = pledge.valueCents
          ? `$${(pledge.valueCents / 100).toFixed(2)}`
          : pledge.value || null;

        insertStmts.push(
          db
            .prepare(
              `INSERT INTO user_fleet (user_id, vehicle_id, insurance_type_id, warbond, is_loaner,
                pledge_id, pledge_name, pledge_cost, pledge_date, custom_name, imported_at)
              VALUES (?, (SELECT id FROM vehicles WHERE slug = ? AND ${VEHICLE_VERSION_CAP} ORDER BY game_version_id DESC LIMIT 1), ?, ?, ?,
                ?, ?, ?, ?, ?, datetime('now'))`,
            )
            .bind(
              userID,
              matchedSlug,
              insuranceTypeID,
              pledge.isWarbond ? 1 : 0,
              0,
              String(pledge.id),
              pledge.name || null,
              pledgeCost,
              pledge.date || null,
              customName,
            ),
        );
      }
    }

    // Create stub vehicles if needed
    if (stubStmts.length > 0) {
      for (let i = 0; i < stubStmts.length; i += 100) {
        await db.batch(stubStmts.slice(i, i + 100));
      }
      console.log(`[hangar-sync] Created ${stubStmts.length} stub vehicles: ${stubSlugs.join(", ")}`);
    }

    // Fleet swap
    if (insertStmts.length > 0) {
      await executeFleetSwap(db, userID, insertStmts);
    }
    const imported = insertStmts.length;

    // --- Profile upsert ---
    let hasProfile = false;
    if (payload.account) {
      const acct = payload.account;
      await db
        .prepare(
          `INSERT INTO user_rsi_profiles (user_id, rsi_handle, rsi_displayname, avatar_url,
            enlisted_since, country, concierge_level, subscriber_type, subscriber_frequency,
            store_credit_cents, uec_balance, rec_balance, referral_code, has_game_package,
            orgs_json, badges_json, featured_badges_json, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET
            rsi_handle = excluded.rsi_handle,
            rsi_displayname = excluded.rsi_displayname,
            avatar_url = excluded.avatar_url,
            enlisted_since = excluded.enlisted_since,
            country = excluded.country,
            concierge_level = excluded.concierge_level,
            subscriber_type = excluded.subscriber_type,
            subscriber_frequency = excluded.subscriber_frequency,
            store_credit_cents = excluded.store_credit_cents,
            uec_balance = excluded.uec_balance,
            rec_balance = excluded.rec_balance,
            referral_code = excluded.referral_code,
            has_game_package = excluded.has_game_package,
            orgs_json = excluded.orgs_json,
            badges_json = excluded.badges_json,
            featured_badges_json = excluded.featured_badges_json,
            synced_at = excluded.synced_at`,
        )
        .bind(
          userID,
          acct.nickname || null,
          acct.displayname || null,
          acct.avatar_url || null,
          acct.enlisted_since || null,
          acct.country || null,
          acct.concierge_level || null,
          acct.subscriber_type || null,
          acct.subscriber_frequency || null,
          acct.store_credit_cents ?? null,
          acct.uec_balance ?? null,
          acct.rec_balance ?? null,
          acct.referral_code || null,
          acct.has_game_package ? 1 : 0,
          acct.orgs ? JSON.stringify(acct.orgs) : null,
          acct.all_badges ? JSON.stringify(acct.all_badges) : null,
          acct.featured_badges ? JSON.stringify(acct.featured_badges) : null,
        )
        .run();
      hasProfile = true;
    }

    // --- Buy-back pledges: DELETE + INSERT ---
    let buybackCount = 0;
    if (payload.buyback_pledges.length > 0) {
      await db
        .prepare("DELETE FROM user_buyback_pledges WHERE user_id = ?")
        .bind(userID)
        .run();

      const bbStmts: D1PreparedStatement[] = [];
      for (const bb of payload.buyback_pledges) {
        bbStmts.push(
          db
            .prepare(
              `INSERT INTO user_buyback_pledges (user_id, rsi_pledge_id, name, value_cents, date,
                is_credit_reclaimable, items_json, synced_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            )
            .bind(
              userID,
              bb.id,
              bb.name,
              bb.value_cents ?? null,
              bb.date_parsed || bb.date || null,
              bb.is_credit_reclaimable ? 1 : 0,
              bb.items.length > 0 ? JSON.stringify(bb.items) : null,
            ),
        );
      }

      for (let i = 0; i < bbStmts.length; i += 1000) {
        await db.batch(bbStmts.slice(i, i + 1000));
      }
      buybackCount = bbStmts.length;
    }

    // --- Upgrades ---
    // user_pledge_upgrades has FK to user_pledges(id) which we don't populate
    // in this flow. Upgrade data is stored in the payload for future use.
    const upgradeCount = payload.upgrades.length;

    // --- Log change history ---
    console.log(`[hangar-sync] Sync complete: ${imported} ships, ${buybackCount} buyback, ${upgradeCount} upgrades`);
    logEvent("hangar_sync", {
      imported,
      buyback_count: buybackCount,
      upgrade_count: upgradeCount,
      has_profile: hasProfile,
      extension_version: payload.sync_meta.extension_version,
    });
    await logUserChange(db, userID, "hangar_synced", {
      metadata: {
        vehicle_count: imported,
        buyback_count: buybackCount,
        upgrade_count: upgradeCount,
        extension_version: payload.sync_meta.extension_version,
      },
      ipAddress: c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for"),
    });

    return c.json({
      imported,
      buyback_count: buybackCount,
      upgrade_count: upgradeCount,
      has_profile: hasProfile,
      message: "Hangar sync complete",
    });
   } catch (err) {
    console.error("[hangar-sync] Unhandled error:", err instanceof Error ? err.message : err, err instanceof Error ? err.stack : "");
    return c.json({ error: err instanceof Error ? err.message : "Sync failed" }, 500);
   }
  });

  return routes;
}
