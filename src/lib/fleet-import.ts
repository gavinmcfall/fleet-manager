/**
 * Shared fleet import helpers — used by both HangarXplor and hangar-sync imports.
 */

import { compactSlug } from "./slug";
import { VEHICLE_VERSION_CAP } from "./constants";

// --- Preloaded vehicle map for in-memory slug matching ---

export interface VehicleMap {
  slugToID: Map<string, number>;
  nameToSlug: Map<string, string>;
  compactToSlug: Map<string, string>;
}

export async function preloadVehicleMap(db: D1Database): Promise<VehicleMap> {
  // Load active vehicles (non-removed)
  const result = await db
    .prepare(`SELECT v.id, v.slug, v.name FROM vehicles v
      INNER JOIN (
        SELECT slug, MAX(game_version_id) as latest_gv
        FROM vehicles
        WHERE ${VEHICLE_VERSION_CAP}
        GROUP BY slug
      ) _vv ON v.slug = _vv.slug AND v.game_version_id = _vv.latest_gv
      WHERE v.removed = 0`)
    .all();

  const slugToID = new Map<string, number>();
  const nameToSlug = new Map<string, string>();
  const compactToSlug = new Map<string, string>();

  for (const row of result.results) {
    const r = row as { id: number; slug: string; name: string };
    slugToID.set(r.slug, r.id);
    nameToSlug.set(r.name.toLowerCase(), r.slug);
    compactToSlug.set(compactSlug(r.slug), r.slug);
  }

  // Load removed vehicles with replacements — map old slug/name to replacement vehicle
  const removed = await db
    .prepare(`SELECT v.id, v.slug, v.name, rv.id as replacement_id, rv.slug as replacement_slug, rv.name as replacement_name
      FROM vehicles v
      INNER JOIN (
        SELECT slug, MAX(game_version_id) as latest_gv
        FROM vehicles
        WHERE ${VEHICLE_VERSION_CAP}
        GROUP BY slug
      ) _vv ON v.slug = _vv.slug AND v.game_version_id = _vv.latest_gv
      JOIN vehicles rv ON rv.id = v.replaced_by_vehicle_id
      WHERE v.removed = 1 AND v.replaced_by_vehicle_id IS NOT NULL`)
    .all();

  for (const row of removed.results) {
    const r = row as { slug: string; name: string; replacement_id: number; replacement_slug: string };
    // Old slug/name resolve to the replacement vehicle
    if (!slugToID.has(r.slug)) {
      slugToID.set(r.slug, r.replacement_id);
    }
    const lowerName = r.name.toLowerCase();
    if (!nameToSlug.has(lowerName)) {
      nameToSlug.set(lowerName, r.replacement_slug);
    }
    const compact = compactSlug(r.slug);
    if (!compactToSlug.has(compact)) {
      compactToSlug.set(compact, r.replacement_slug);
    }
  }

  return { slugToID, nameToSlug, compactToSlug };
}

export function findVehicleSlugLocal(
  map: VehicleMap,
  candidateSlugs: string[],
  displayName: string,
): string | null {
  // Try exact slug matches
  for (const slug of candidateSlugs) {
    if (!slug) continue;
    if (map.slugToID.has(slug)) return slug;
  }

  // Try name match
  if (displayName) {
    const found = map.nameToSlug.get(displayName.toLowerCase());
    if (found) return found;
  }

  // Try compact match
  for (const slug of candidateSlugs) {
    if (!slug) continue;
    const compact = compactSlug(slug);
    const found = map.compactToSlug.get(compact);
    if (found) return found;
  }

  // Try prefix match — existing slug starts with candidate
  for (const slug of candidateSlugs) {
    if (!slug || slug.length < 3) continue;
    for (const [existingSlug] of map.slugToID) {
      if (existingSlug.startsWith(slug)) return existingSlug;
    }
  }

  // Try reverse prefix — candidate starts with existing slug (handles verbose RSI names
  // like "Carrack Expedition with Pisces Expedition" matching "carrack-expedition",
  // or "Idris-P Frigate" matching "idris-p")
  for (const slug of candidateSlugs) {
    if (!slug || slug.length < 3) continue;
    let bestMatch: string | null = null;
    let bestLen = 0;
    for (const [existingSlug] of map.slugToID) {
      if (slug.startsWith(existingSlug) && existingSlug.length > bestLen) {
        bestMatch = existingSlug;
        bestLen = existingSlug.length;
      }
    }
    if (bestMatch) return bestMatch;
  }

  return null;
}

// --- Paint matching ---

export interface PaintMap {
  normalizedToID: Map<string, number>;
}

/** Normalize RSI paint title: "100 Series - Blue Ametrine Paint" → "100 series blue ametrine" */
export function normalizePaintTitle(rsiTitle: string): string {
  return rsiTitle
    .replace(/\s*-\s*/g, " ")       // " - " → " "
    .replace(/\s+paint$/i, "")       // strip trailing " Paint"
    .replace(/\s+/g, " ")            // collapse whitespace
    .trim()
    .toLowerCase();
}

/** Normalize DB paint name: "100 Series Blue Ametrine Livery" → "100 series blue ametrine" */
function normalizeDbPaintName(dbName: string): string {
  return dbName
    .replace(/\s+camo\s+livery$/i, "")  // strip " Camo Livery"
    .replace(/\s+livery$/i, "")          // strip " Livery"
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export async function preloadPaintMap(db: D1Database): Promise<PaintMap> {
  const result = await db
    .prepare("SELECT id, name FROM paints WHERE is_base_variant = 0")
    .all();

  const normalizedToID = new Map<string, number>();
  for (const row of result.results) {
    const r = row as { id: number; name: string };
    const normalized = normalizeDbPaintName(r.name);
    if (!normalizedToID.has(normalized)) {
      normalizedToID.set(normalized, r.id);
    }
  }
  return { normalizedToID };
}

export function findPaintLocal(map: PaintMap, rsiTitle: string): number | null {
  if (!rsiTitle) return null;
  const normalized = normalizePaintTitle(rsiTitle);
  return map.normalizedToID.get(normalized) ?? null;
}

// --- Buyback name parsers ---

/** Strip SC manufacturer prefix from a ship name */
const MFR_PREFIX = /^(Anvil Aerospace|Aegis Dynamics|Origin Jumpworks|Drake Interplanetary|Crusader Industries|Musashi Industrial|Consolidated Outland|Argo Astronautics|Roberts Space Industries|Kruger Intergalaktik|Greycat Industrial|Anvil|Aegis|AEGIS|RSI|Origin|Drake|Crusader|CNOU|MISC|Argo|Tumbril|Greycat|Aopoa|AOPOA|Esperia|Gatac|Banu|Kruger)\s+/i;

export function stripManufacturer(name: string): string {
  return name.replace(MFR_PREFIX, "").trim();
}

/** Parse buyback ship name: "Standalone Ship - Anvil C8X Pisces Expedition - IAE 2949" → "C8X Pisces Expedition" */
export function parseBuybackShipName(pledgeName: string): string {
  let name = pledgeName;
  // Strip prefix
  name = name.replace(/^Standalone Ships?\s*-\s*/i, "");
  name = name.replace(/^Buggies\s*-\s*/i, "");
  // Strip trailing dash-separated suffixes
  name = name.replace(/\s*-\s*(Warbond|IAE\s*\d+|ILW\s*\d+|LTI|\d+\s*Year|Anniversary\s*\d+|Citizencon\s*\d+|Gamescom\s*\d+|Presale).*$/i, "");
  // Strip trailing modifiers without dash
  name = name.replace(/\s+(LTI\s+Presale|LTI|Presale|Anniversary\s*\d+|Gamescom\s*\d+)$/i, "");
  // Strip "plus {Paint} Paint" suffix
  name = name.replace(/\s+plus\s+.+paint$/i, "");
  // Strip manufacturer prefix
  name = stripManufacturer(name);
  return name.trim();
}

/** Parse buyback paint name: "Paints - Terrapin - Felicity Paint" → "Terrapin - Felicity Paint" */
export function parseBuybackPaintName(pledgeName: string): string {
  return pledgeName.replace(/^Paints\s*-\s*/i, "").trim();
}

/** Parse CCU names: returns [fromShip, toShip] or null */
export function parseCCUNames(pledgeName: string): [string, string] | null {
  let name = pledgeName;
  // Strip prefixes
  name = name.replace(/^Ship Upgrades\s*-\s*/i, "");
  name = name.replace(/^Upgrade\s*-\s*/i, "");
  // Strip suffixes
  name = name.replace(/\s+Upgrade$/i, "");
  name = name.replace(/\s+(Standard|Warbond)\s+Edition$/i, "");
  // Strip trailing " - News Van" etc. (variant suffixes after dash)
  name = name.replace(/\s*-\s*[^-]+$/i, (match) => {
    // Only strip if the part after dash looks like a variant/edition, not a ship name
    const suffix = match.replace(/^\s*-\s*/, "").trim();
    if (/^(News Van|Warbond|Best In Show|BIS|Executive|Explorer|Touring)$/i.test(suffix)) return "";
    return match; // Keep it — it's part of the ship name (e.g., "San'tok.yai")
  });

  // Split on " to " — the divider between from and to ships
  const toIdx = name.toLowerCase().indexOf(" to ");
  if (toIdx < 1) return null;

  let from = name.slice(0, toIdx).trim();
  let to = name.slice(toIdx + 4).trim();
  if (!from || !to) return null;

  // Strip manufacturer prefixes from both sides
  from = stripManufacturer(from);
  to = stripManufacturer(to);

  return [from, to];
}

/** Classify buyback pledge type from its name */
export function classifyBuyback(name: string): "ship" | "paint" | "ccu" | "gear" | "addon" | "other" {
  if (/^Standalone Ship/i.test(name) || /^Buggies/i.test(name)) return "ship";
  if (/^Paints/i.test(name)) return "paint";
  if (/^(Ship Upgrades|Upgrade)\s*-/i.test(name)) return "ccu";
  if (/^Gear/i.test(name)) return "gear";
  if (/^Add-Ons/i.test(name)) return "addon";
  return "other";
}

// --- Date and value parsing helpers ---

/**
 * Parse RSI date strings like "August 19, 2025" or "Feb 28 2020, 7:41 am" to ISO format.
 * Returns null if unparseable.
 */
export function parseRsiDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed;

  // Try Date.parse (handles "August 19, 2025" and "Feb 28 2020, 7:41 am")
  const ts = Date.parse(trimmed);
  if (!isNaN(ts)) {
    const d = new Date(ts);
    const iso = d.toISOString();
    // Return date only if no time component in input, otherwise full ISO
    if (/\d{1,2}:\d{2}/.test(trimmed)) {
      return iso.replace("Z", "").replace(/\.000$/, "");
    }
    return iso.slice(0, 10);
  }

  return null;
}

/**
 * Parse RSI value strings like "$295.00 USD" or "$1,500.00" to cents.
 * Returns null if unparseable.
 */
export function parseValueCents(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (!match) return null;
  const num = parseFloat(match[1].replace(/,/g, ""));
  if (isNaN(num)) return null;
  return Math.round(num * 100);
}

/**
 * Insert-then-swap pattern for fleet imports.
 *
 * Inserts all new entries first, then deletes old ones. This avoids data loss
 * if a batch fails partway through — old entries remain until all new entries
 * are confirmed. IDs are AUTOINCREMENT so new entries always have higher IDs.
 */
export async function executeFleetSwap(
  db: D1Database,
  userID: string,
  insertStmts: D1PreparedStatement[],
): Promise<void> {
  await executeTableSwap(db, "user_fleet", userID, insertStmts, 1000);
}

/**
 * Generic insert-then-swap for any user-scoped table with AUTOINCREMENT id.
 *
 * 1. Record MAX(id) of existing rows for this user
 * 2. Insert all new rows (which get higher IDs)
 * 3. Delete only rows with id <= the recorded max
 *
 * If inserts fail, old data is preserved. If delete fails, both old and new
 * data coexist (duplicates, but no data loss).
 */
export async function executeTableSwap(
  db: D1Database,
  table: string,
  userID: string,
  insertStmts: D1PreparedStatement[],
  batchSize = 1000,
): Promise<void> {
  if (insertStmts.length === 0) return;

  const maxRow = await db
    .prepare(`SELECT MAX(id) as max_id FROM ${table} WHERE user_id = ?`)
    .bind(userID)
    .first<{ max_id: number | null }>();
  const maxExistingId = maxRow?.max_id ?? 0;

  for (let i = 0; i < insertStmts.length; i += batchSize) {
    await db.batch(insertStmts.slice(i, i + batchSize));
  }

  await db
    .prepare(`DELETE FROM ${table} WHERE user_id = ? AND id <= ?`)
    .bind(userID, maxExistingId)
    .run();
}
