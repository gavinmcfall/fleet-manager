/**
 * SC Wiki API client + sync logic — ported from internal/scwiki/
 *
 * Primary data source for: manufacturers, game versions, vehicles (specs,
 * dimensions, pricing, status), items (components, FPS weapons, armour, etc.)
 */

import {
  upsertManufacturer,
  upsertGameVersion,
  upsertVehicle,
  upsertPort,
  syncVehicleLoaners,
  upsertComponent,
  upsertFPSWeapon,
  upsertFPSArmour,
  upsertFPSAttachment,
  upsertFPSUtility,
  insertSyncHistory,
  updateSyncHistory,
  getManufacturerIDByUUID,
  getManufacturerIDByName,
  getGameVersionIDByUUID,
  getProductionStatusIDByKey,
} from "../db/queries";
import { delay } from "../lib/utils";

// --- SC Wiki API Types ---

interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

interface APIResponse {
  data: unknown[];
  meta?: PaginationMeta;
}

interface SCWikiManufacturer {
  uuid: string;
  name: string;
  code: string;
  slug: string;
  known_for: string;
  description: string;
  logo_url: string;
}

interface SCWikiGameVersion {
  uuid: string;
  code: string;
  channel: string;
  is_default: boolean;
  released_at: string | null;
}

interface LocalizedString {
  en_EN: string;
}

interface SCWikiVehicle {
  uuid: string;
  class_name: string;
  name: string;
  slug: string;
  manufacturer?: SCWikiManufacturer;
  size_class: number;
  career: string;
  role: string;
  is_vehicle: boolean;
  is_gravlev: boolean;
  is_spaceship: boolean;
  mass_total: number;
  cargo_capacity: number;
  vehicle_inventory: number;
  crew?: { min: number; max: number };
  speed?: { scm: number; max: number };
  sizes?: { length: number; beam: number; height: number };
  msrp: number;
  pledge_url: string;
  production_status?: LocalizedString;
  description?: LocalizedString;
  size?: LocalizedString;
  foci?: LocalizedString[];
  health: number;
  shield_hp: number;
  game_version?: SCWikiGameVersion;
  ports?: SCWikiPort[];
  loaner?: { uuid: string; name: string; slug: string }[];
  skus?: { title: string; price: number; available: boolean }[];
}

interface SCWikiPort {
  uuid: string;
  name: string;
  category_label: string;
  size_min: number;
  size_max: number;
  port_type: string;
  equipped_item?: SCWikiItem;
}

interface SCWikiItem {
  uuid: string;
  class_name: string;
  name: string;
  slug: string;
  manufacturer?: SCWikiManufacturer;
  type: string;
  sub_type: string;
  size: number;
  grade: string | number;
  game_version?: SCWikiGameVersion;
}

// --- Rate-limited HTTP client ---

const SC_WIKI_BASE_URL = "https://api.star-citizen.wiki";
const USER_AGENT = "Fleet-Manager/1.0";

const MAX_RETRIES = 3;

async function scwikiFetch(path: string, rateLimitMs: number, attempt = 0): Promise<unknown> {
  await delay(rateLimitMs);

  const url = SC_WIKI_BASE_URL + path;
  const resp = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (resp.status === 429) {
    if (attempt >= MAX_RETRIES) {
      throw new Error(`SC Wiki rate limited (429) after ${MAX_RETRIES} retries on ${path}`);
    }
    const retryAfter = parseInt(resp.headers.get("Retry-After") ?? "5", 10);
    await delay(retryAfter * 1000);
    return scwikiFetch(path, rateLimitMs, attempt + 1);
  }

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`SC Wiki API error (${resp.status}): ${body.slice(0, 200)}`);
  }

  return resp.json();
}

async function fetchPaginated(path: string, rateLimitMs: number): Promise<unknown[]> {
  const allData: unknown[] = [];
  let page = 1;

  for (;;) {
    const separator = path.includes("?") ? "&" : "?";
    const pagePath = `${path}${separator}page[number]=${page}&page[size]=100`;

    const response = (await scwikiFetch(pagePath, rateLimitMs)) as APIResponse;
    if (!response.data || response.data.length === 0) break;

    allData.push(...response.data);

    if (response.meta && page >= response.meta.last_page) break;
    page++;
  }

  return allData;
}

import { SYNC_SOURCE } from "../lib/constants";

// --- Sync Functions ---

export async function syncAll(db: D1Database, rateLimitMs = 1000): Promise<void> {
  console.log("[scwiki] Starting full SC Wiki sync");
  const start = Date.now();

  await syncManufacturers(db, rateLimitMs);

  try {
    await syncGameVersions(db, rateLimitMs);
  } catch (err) {
    console.warn("[scwiki] Game version sync failed (non-fatal):", err);
  }

  await syncVehicles(db, rateLimitMs);
  await syncItems(db, rateLimitMs);

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[scwiki] Full SC Wiki sync complete in ${duration}s`);
}

async function syncManufacturers(db: D1Database, rateLimitMs: number): Promise<void> {
  const syncID = await insertSyncHistory(db, SYNC_SOURCE.SCWIKI, "manufacturers", "running");

  try {
    const data = await fetchPaginated("/api/manufacturers", rateLimitMs);
    let count = 0;

    for (const raw of data) {
      const m = raw as SCWikiManufacturer;
      try {
        await upsertManufacturer(db, {
          uuid: m.uuid,
          name: m.name,
          slug: m.slug,
          code: m.code,
          known_for: m.known_for,
          description: m.description,
          logo_url: m.logo_url,
        });
        count++;
      } catch (err) {
        console.warn(`[scwiki] Failed to upsert manufacturer ${m.name}:`, err);
      }
    }

    await updateSyncHistory(db, syncID, "success", count, "");
    console.log(`[scwiki] Manufacturers synced: ${count}`);
  } catch (err) {
    await updateSyncHistory(db, syncID, "error", 0, String(err));
    throw err;
  }
}

async function syncGameVersions(db: D1Database, rateLimitMs: number): Promise<void> {
  const syncID = await insertSyncHistory(db, SYNC_SOURCE.SCWIKI, "game_versions", "running");

  try {
    const data = await fetchPaginated("/api/game-versions", rateLimitMs);
    let count = 0;

    for (const raw of data) {
      const gv = raw as SCWikiGameVersion;
      try {
        await upsertGameVersion(db, {
          uuid: gv.uuid,
          code: gv.code,
          channel: gv.channel,
          is_default: gv.is_default,
          released_at: gv.released_at ?? undefined,
        });
        count++;
      } catch (err) {
        console.warn(`[scwiki] Failed to upsert game version ${gv.code}:`, err);
      }
    }

    await updateSyncHistory(db, syncID, "success", count, "");
    console.log(`[scwiki] Game versions synced: ${count}`);
  } catch (err) {
    await updateSyncHistory(db, syncID, "error", 0, String(err));
    throw err;
  }
}

async function syncVehicles(db: D1Database, rateLimitMs: number): Promise<void> {
  const syncID = await insertSyncHistory(db, SYNC_SOURCE.SCWIKI, "vehicles", "running");

  try {
    const data = await fetchPaginated(
      "/api/vehicles?include=manufacturer,game_version,ports,loaner",
      rateLimitMs,
    );
    let count = 0;

    for (const raw of data) {
      const v = raw as SCWikiVehicle;
      try {
        // Resolve manufacturer ID
        let manufacturerID: number | null = null;
        if (v.manufacturer) {
          manufacturerID = await getManufacturerIDByUUID(db, v.manufacturer.uuid);
          if (manufacturerID === null && v.manufacturer.name) {
            manufacturerID = await getManufacturerIDByName(db, v.manufacturer.name);
          }
        }

        // Resolve game version ID
        let gameVersionID: number | null = null;
        if (v.game_version) {
          gameVersionID = await getGameVersionIDByUUID(db, v.game_version.uuid);
        }

        // Extract crew
        const crewMin = v.crew?.min ?? 0;
        const crewMax = v.crew?.max ?? 0;

        // Extract speed
        const speedSCM = v.speed?.scm ?? 0;
        const speedMax = v.speed?.max ?? 0;

        // Determine vehicle type ID
        let vehicleTypeID: number | null = null;
        if (v.is_spaceship) vehicleTypeID = 1;
        else if (v.is_gravlev) vehicleTypeID = 3;
        else if (v.is_vehicle) vehicleTypeID = 2;

        // Extract dimensions
        const length = v.sizes?.length ?? 0;
        const beam = v.sizes?.beam ?? 0;
        const height = v.sizes?.height ?? 0;

        // Extract focus
        let focus = v.role;
        if (v.foci && v.foci.length > 0 && v.foci[0].en_EN) {
          focus = v.foci[0].en_EN;
        }

        // Extract description and size label
        const description = v.description?.en_EN ?? "";
        const sizeLabel = v.size?.en_EN ?? "";

        // Resolve production_status_id
        let productionStatusID: number | null = null;
        if (v.production_status?.en_EN) {
          let psKey = v.production_status.en_EN;
          if (psKey === "flight-ready") psKey = "flight_ready";
          else if (psKey === "in-production") psKey = "in_production";
          else if (psKey === "in-concept") psKey = "in_concept";
          productionStatusID = await getProductionStatusIDByKey(db, psKey);
        }

        // Derive on_sale from SKUs
        const onSale = v.skus?.some((s) => s.available) ?? false;

        const vehicleID = await upsertVehicle(db, {
          uuid: v.uuid,
          slug: v.slug,
          name: v.name,
          class_name: v.class_name,
          manufacturer_id: manufacturerID ?? undefined,
          vehicle_type_id: vehicleTypeID ?? undefined,
          production_status_id: productionStatusID ?? undefined,
          size_label: sizeLabel,
          focus,
          classification: v.career,
          description,
          length,
          beam,
          height,
          mass: v.mass_total,
          cargo: v.cargo_capacity,
          vehicle_inventory: v.vehicle_inventory,
          crew_min: crewMin,
          crew_max: crewMax,
          speed_scm: speedSCM,
          speed_max: speedMax,
          health: v.health,
          pledge_price: v.msrp,
          on_sale: onSale,
          pledge_url: v.pledge_url,
          game_version_id: gameVersionID ?? undefined,
        });

        // Upsert ports
        if (v.ports) {
          for (const port of v.ports) {
            await upsertPort(db, {
              uuid: port.uuid,
              vehicle_id: vehicleID,
              name: port.name,
              category_label: port.category_label,
              size_min: port.size_min,
              size_max: port.size_max,
              port_type: port.port_type,
              equipped_item_uuid: port.equipped_item?.uuid ?? "",
            });
          }
        }

        // Sync loaners
        if (v.loaner && v.loaner.length > 0) {
          const loanerSlugs = v.loaner.filter((l) => l.slug).map((l) => l.slug);
          if (loanerSlugs.length > 0) {
            await syncVehicleLoaners(db, vehicleID, loanerSlugs);
          }
        }

        count++;
      } catch (err) {
        console.warn(`[scwiki] Failed to upsert vehicle ${v.name}:`, err);
      }
    }

    await updateSyncHistory(db, syncID, "success", count, "");
    console.log(`[scwiki] Vehicles synced: ${count}`);
  } catch (err) {
    await updateSyncHistory(db, syncID, "error", 0, String(err));
    throw err;
  }
}

async function syncItems(db: D1Database, rateLimitMs: number): Promise<void> {
  const syncID = await insertSyncHistory(db, SYNC_SOURCE.SCWIKI, "items", "running");

  try {
    const data = await fetchPaginated(
      "/api/items?include=manufacturer,game_version",
      rateLimitMs,
    );
    let count = 0;

    for (const raw of data) {
      const item = raw as SCWikiItem;
      if (!isRelevantItemType(item.type)) continue;

      try {
        // Resolve manufacturer ID
        let manufacturerID: number | null = null;
        if (item.manufacturer) {
          manufacturerID = await getManufacturerIDByUUID(db, item.manufacturer.uuid);
          if (manufacturerID === null && item.manufacturer.name) {
            manufacturerID = await getManufacturerIDByName(db, item.manufacturer.name);
          }
        }

        // Resolve game version ID
        let gameVersionID: number | null = null;
        if (item.game_version) {
          gameVersionID = await getGameVersionIDByUUID(db, item.game_version.uuid);
        }

        const rawData = JSON.stringify(raw);
        await routeItem(db, item, manufacturerID, gameVersionID, rawData);
        count++;
      } catch (err) {
        console.warn(`[scwiki] Failed to upsert item ${item.name} (${item.type}):`, err);
      }
    }

    await updateSyncHistory(db, syncID, "success", count, "");
    console.log(`[scwiki] Items synced: ${count}`);
  } catch (err) {
    await updateSyncHistory(db, syncID, "error", 0, String(err));
    throw err;
  }
}

// --- Item routing ---

async function routeItem(
  db: D1Database,
  item: SCWikiItem,
  manufacturerID: number | null,
  gameVersionID: number | null,
  _rawData: string,
): Promise<void> {
  const grade = String(item.grade ?? "");
  const mfgID = manufacturerID ?? undefined;
  const gvID = gameVersionID ?? undefined;

  if (isShipComponent(item.type)) {
    await upsertComponent(db, {
      uuid: item.uuid,
      name: item.name,
      slug: item.slug,
      class_name: item.class_name,
      manufacturer_id: mfgID,
      type: item.type,
      sub_type: item.sub_type,
      size: item.size,
      grade,
      game_version_id: gvID,
    });
  } else if (item.type === "WeaponPersonal") {
    await upsertFPSWeapon(db, {
      uuid: item.uuid,
      name: item.name,
      slug: item.slug,
      class_name: item.class_name,
      manufacturer_id: mfgID,
      sub_type: item.sub_type,
      size: item.size,
      game_version_id: gvID,
    });
  } else if (isFPSArmour(item.type)) {
    await upsertFPSArmour(db, {
      uuid: item.uuid,
      name: item.name,
      slug: item.slug,
      class_name: item.class_name,
      manufacturer_id: mfgID,
      sub_type: item.sub_type,
      size: item.size,
      grade,
      game_version_id: gvID,
    });
  } else if (item.type === "WeaponAttachment") {
    await upsertFPSAttachment(db, {
      uuid: item.uuid,
      name: item.name,
      slug: item.slug,
      class_name: item.class_name,
      manufacturer_id: mfgID,
      sub_type: item.sub_type,
      size: item.size,
      game_version_id: gvID,
    });
  } else if (isFPSUtility(item.type)) {
    await upsertFPSUtility(db, {
      uuid: item.uuid,
      name: item.name,
      slug: item.slug,
      class_name: item.class_name,
      manufacturer_id: mfgID,
      sub_type: item.sub_type,
      game_version_id: gvID,
    });
  }
}

const SHIP_COMPONENTS = new Set([
  "WeaponGun",
  "WeaponMissile",
  "TurretBase",
  "PowerPlant",
  "Cooler",
  "QuantumDrive",
  "Shield",
  "ShieldGenerator",
  "MainThruster",
  "ManneuverThruster",
  "QuantumInterdictionGenerator",
  "Radar",
  "Scanner",
  "Avionics",
]);

function isShipComponent(type: string): boolean {
  return SHIP_COMPONENTS.has(type);
}

function isFPSArmour(type: string): boolean {
  return type === "Armor" || type === "Helmet" || type === "Undersuit";
}

const FPS_UTILITIES = new Set(["MedPen", "Gadget", "Grenade", "Backpack"]);

function isFPSUtility(type: string): boolean {
  return FPS_UTILITIES.has(type);
}

function isRelevantItemType(type: string): boolean {
  return (
    isShipComponent(type) ||
    type === "WeaponPersonal" ||
    isFPSArmour(type) ||
    type === "WeaponAttachment" ||
    isFPSUtility(type)
  );
}
