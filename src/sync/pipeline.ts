/**
 * Sync pipeline orchestration
 *
 * RSI API images (ships only) — live sync from RSI GraphQL.
 * Paint images are managed via manual upload — no automated sync.
 *
 * Workers are single-threaded per invocation, so no sync mutex needed.
 */

import { syncAll as syncRSI, syncShipProductionStatus } from "./rsi";
import { getVehicleCount } from "../db/queries";
import type { Env } from "../lib/types";
import { logEvent } from "../lib/logger";

// --- Individual sync functions (for manual triggers) ---

export async function triggerRSISync(env: Env): Promise<string> {
  if (env.RSI_API_ENABLED !== "true") {
    return "RSI API sync not enabled (set RSI_API_ENABLED=true)";
  }

  const baseURL = env.RSI_BASE_URL || "https://robertsspaceindustries.com";
  const rateLimitMs = parseFloat(env.RSI_RATE_LIMIT || "1") * 1000;

  console.log("[pipeline] RSI API image sync triggered");
  logEvent("sync_start", { source: "rsi_images" });
  const start = Date.now();
  try {
    await syncRSI(env.DB, baseURL, rateLimitMs);
    logEvent("sync_complete", { source: "rsi_images", duration_s: (Date.now() - start) / 1000 });
  } catch (err) {
    logEvent("sync_error", { source: "rsi_images", error: String(err) });
    throw err;
  }
  return "RSI API sync complete";
}

// Ship production status sync — fetches the live /ship-matrix/index JSON to
// update vehicles.production_status_id + is_pledgeable. This is a lightweight
// single-request sync against a public endpoint (no auth, no rate limiting
// concerns) so it is NOT gated on RSI_API_ENABLED — it's safe to run on
// staging and production regardless of the image-sync toggle.
export async function triggerShipProductionStatusSync(env: Env): Promise<string> {
  console.log("[pipeline] Ship production status sync triggered");
  logEvent("sync_start", { source: "rsi_production_status" });
  const start = Date.now();
  try {
    await syncShipProductionStatus(env.DB);
    logEvent("sync_complete", {
      source: "rsi_production_status",
      duration_s: (Date.now() - start) / 1000,
    });
  } catch (err) {
    logEvent("sync_error", { source: "rsi_production_status", error: String(err) });
    throw err;
  }
  return "Ship production status sync complete";
}

// --- Full sync pipeline ---
// WARNING: runs all sync steps in one Worker invocation. Use staggered cron
// triggers in production. This function is for local dev / manual trigger only
// and may exceed Workers CPU limits with large datasets.

export async function runFullSync(env: Env): Promise<void> {
  const start = Date.now();
  console.log("[pipeline] Full sync pipeline starting (dev/manual — use cron triggers in production)");

  const db = env.DB;
  const rsiEnabled = env.RSI_API_ENABLED === "true";

  // Only run image sync if vehicles exist
  const vehicleCount = await getVehicleCount(db);
  if (vehicleCount === 0) {
    console.warn("[pipeline] No vehicles in DB, skipping image sync");
    return;
  }

  // RSI API images
  if (rsiEnabled) {
    try {
      const baseURL = env.RSI_BASE_URL || "https://robertsspaceindustries.com";
      const rateLimitMs = parseFloat(env.RSI_RATE_LIMIT || "1") * 1000;
      console.log("[pipeline] RSI API image sync starting");
      await syncRSI(db, baseURL, rateLimitMs);
    } catch (err) {
      console.error("[pipeline] RSI API image sync failed:", err);
    }
  }

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[pipeline] Full sync pipeline complete in ${duration}s`);
}
