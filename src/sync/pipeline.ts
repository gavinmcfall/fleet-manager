/**
 * Sync pipeline orchestration — ported from internal/sync/scheduler.go
 *
 * Orchestrates the sync chain:
 * 1. SC Wiki (primary data: manufacturers, game versions, vehicles, items)
 * 2. FleetYards ship images
 * 3. scunpacked paint metadata (via GitHub API)
 * 4. FleetYards paint images
 * 5. RSI API images (ship + paint, overwrites FleetYards with RSI CDN URLs)
 *
 * Workers are single-threaded per invocation, so no sync mutex needed.
 */

import { syncAll as syncSCWiki } from "./scwiki";
import { syncShipImages as syncFYShipImages, syncPaintImages as syncFYPaintImages } from "./fleetyards";
import { syncPaints as syncScunpackedPaints } from "./scunpacked";
import { syncAll as syncRSI } from "./rsi";
import { getManufacturerCount, getVehicleCount } from "../db/queries";
import type { Env } from "../lib/types";

// --- Individual sync functions (for manual triggers) ---

export async function triggerSCWikiSync(env: Env): Promise<string> {
  const rateLimitMs = parseFloat(env.SC_WIKI_RATE_LIMIT || "1") * 1000;

  console.log("[pipeline] SC Wiki sync triggered");
  await syncSCWiki(env.DB, rateLimitMs);
  return "SC Wiki sync complete";
}

export async function triggerImageSync(env: Env): Promise<string> {
  const baseURL = env.FLEETYARDS_BASE_URL || "https://api.fleetyards.net";

  console.log("[pipeline] FleetYards image sync triggered");
  await syncFYShipImages(env.DB, baseURL);
  return "FleetYards image sync complete";
}

export async function triggerPaintSync(env: Env): Promise<string> {
  const repo = env.SCUNPACKED_REPO || "StarCitizenWiki/scunpacked-data";
  const branch = env.SCUNPACKED_BRANCH || "main";
  const baseURL = env.FLEETYARDS_BASE_URL || "https://api.fleetyards.net";

  console.log("[pipeline] Paint sync triggered");

  // Step 1: scunpacked metadata
  await syncScunpackedPaints(env.DB, repo, branch, env.GITHUB_TOKEN);

  // Step 2: FleetYards paint images
  await syncFYPaintImages(env.DB, baseURL);

  return "Paint sync complete";
}

export async function triggerRSISync(env: Env): Promise<string> {
  if (env.RSI_API_ENABLED !== "true") {
    return "RSI API sync not enabled (set RSI_API_ENABLED=true)";
  }

  const baseURL = env.RSI_BASE_URL || "https://robertsspaceindustries.com";
  const rateLimitMs = parseFloat(env.RSI_RATE_LIMIT || "1") * 1000;

  console.log("[pipeline] RSI API image sync triggered");
  await syncRSI(env.DB, baseURL, rateLimitMs);
  return "RSI API sync complete";
}

// --- Full sync pipeline (cron trigger) ---

export async function runFullSync(env: Env): Promise<void> {
  const start = Date.now();
  console.log("[pipeline] Full sync pipeline starting");

  const db = env.DB;
  const scwikiEnabled = env.SC_WIKI_ENABLED !== "false";
  const rsiEnabled = env.RSI_API_ENABLED === "true";

  // Step 1: SC Wiki — primary data source
  if (scwikiEnabled) {
    const mfgCount = await getManufacturerCount(db);
    console.log(`[pipeline] ${mfgCount} manufacturers in DB, running SC Wiki sync`);
    try {
      const rateLimitMs = parseFloat(env.SC_WIKI_RATE_LIMIT || "1") * 1000;
      await syncSCWiki(db, rateLimitMs);
    } catch (err) {
      console.error("[pipeline] SC Wiki sync failed:", err);
    }
  }

  // Only run downstream syncs if vehicles exist
  const vehicleCount = await getVehicleCount(db);
  if (vehicleCount === 0) {
    console.warn("[pipeline] No vehicles in DB after SC Wiki sync, skipping image and paint sync");
    return;
  }

  // Step 2: FleetYards ship images
  try {
    const baseURL = env.FLEETYARDS_BASE_URL || "https://api.fleetyards.net";
    console.log("[pipeline] FleetYards ship image sync starting");
    await syncFYShipImages(db, baseURL);
  } catch (err) {
    console.error("[pipeline] FleetYards ship image sync failed:", err);
  }

  // Step 3: scunpacked paint metadata
  try {
    const repo = env.SCUNPACKED_REPO || "StarCitizenWiki/scunpacked-data";
    const branch = env.SCUNPACKED_BRANCH || "main";
    console.log("[pipeline] scunpacked paint sync starting");
    await syncScunpackedPaints(db, repo, branch, env.GITHUB_TOKEN);
  } catch (err) {
    console.error("[pipeline] scunpacked paint sync failed:", err);
  }

  // Step 4: FleetYards paint images
  try {
    const baseURL = env.FLEETYARDS_BASE_URL || "https://api.fleetyards.net";
    console.log("[pipeline] FleetYards paint image sync starting");
    await syncFYPaintImages(db, baseURL);
  } catch (err) {
    console.error("[pipeline] FleetYards paint image sync failed:", err);
  }

  // Step 5: RSI API images (overwrites FleetYards with RSI CDN URLs)
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
