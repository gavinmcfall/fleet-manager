/**
 * RSI GraphQL API sync — ported from internal/rsi/
 *
 * Fetches ship images from the RSI public store GraphQL API.
 * No authentication required — all browse queries are public.
 * Paint images are managed via manual upload — no automated sync.
 *
 * Key features:
 * - Batched GraphQL requests (RSI expects JSON array)
 * - Rate limiting with 429 retry
 * - Ship variant inheritance (unmatched variants get base vehicle images)
 * - Media ID extraction for CDN URL size variants
 */

import {
  getAllVehicleNameSlugs,
  buildUpdateVehicleImagesStatement,
  insertSyncHistory,
  updateSyncHistory,
} from "../db/queries";
import { delay, chunkArray } from "../lib/utils";
import { SYNC_SOURCE } from "../lib/constants";
import { logEvent } from "../lib/logger";

// --- Constants ---
const PAGE_LIMIT = 100;
const MAX_RETRIES = 3;
const USER_AGENT = "Fleet-Manager/1.0 (Star Citizen fleet tracker)";
const GRAPHQL_PATH = "/graphql";

// --- GraphQL Types ---

interface BrowseResource {
  id: string;
  name: string;
  title: string;
  url: string;
  media: {
    thumbnail: {
      storeSmall: string;
    };
  };
  nativePrice: {
    amount: number;
  };
  isPackage: boolean;
}

interface BrowseListing {
  resources: BrowseResource[];
  count: number;
  totalCount: number;
}

interface BrowseResponse {
  store: {
    listing: BrowseListing;
  };
}

interface GraphQLResponse {
  data?: BrowseResponse;
  errors?: Array<{ message: string }>;
}

interface ImageSet {
  imageURL: string;
  small: string;
  medium: string;
  large: string;
}

// --- GraphQL Query ---

const browseQuery = `query GetBrowseItems($query: SearchQuery) {
	store(browse: true) {
		listing: search(query: $query) {
			resources {
				id
				name
				title
				url
				media {
					thumbnail {
						storeSmall
						__typename
					}
					__typename
				}
				nativePrice {
					amount
					__typename
				}
				... on TySku {
					isPackage
					__typename
				}
				__typename
			}
			count
			totalCount
			__typename
		}
		__typename
	}
}`;

// --- Ship name mapping (RSI name → DB name, both lowercased) ---

export const shipNameMap: Record<string, string> = {
  "600i explorer": "600i", // RSI calls it Explorer; our DB slug is just "600i"
  "a2 hercules": "a2 hercules starlifter",
  "c2 hercules": "c2 hercules starlifter",
  "m2 hercules": "m2 hercules starlifter",
  "ares inferno": "ares star fighter inferno",
  "ares ion": "ares star fighter ion",
  mercury: "mercury star runner",
  m50: "m50 interceptor",
  "85x": "85x limited",
  scythe: "vanduul scythe",
  stinger: "esperia stinger",
  "dragonfly black": "dragonfly",
  "c8r pisces": "c8r pisces rescue",
  "anvil ballista dunestalker": "ballista dunestalker",
  "anvil ballista snowblind": "ballista snowblind",
  "argo mole carbon edition": "mole carbon",
  "argo mole talus edition": "mole talus",
  "caterpillar best in show edition 2949": "caterpillar 2949 best in show edition",
  // DB has "Drake Cutlass 2949 Best In Show Edition" (no "Black" in middle)
  "cutlass black best in show edition 2949": "cutlass 2949 best in show edition",
  "hammerhead best in show edition 2949": "hammerhead 2949 best in show edition",
  "reclaimer best in show edition 2949": "reclaimer 2949 best in show edition",
  "valkyrie liberator edition": "valkyrie liberator",
  "gladius pirate edition": "gladius pirate",
  "caterpillar pirate edition": "caterpillar pirate",
  "f7c-m super hornet heartseeker mk i": "f7c-m hornet heartseeker mk i",
  "f7c-m super hornet heartseeker mk ii": "f7c-m hornet heartseeker mk ii",
  "f7c-m super hornet mk i": "f7c-m super hornet mk i",
  "f7c-m super hornet mk ii": "f7c-m super hornet mk ii",
  "f8c lightning executive edition": "f8c lightning executive edition",
  "constellation phoenix emerald": "constellation phoenix emerald",
  "san\u2019tok.y\u0101i": "san\u2019tok.y\u0101i",
  "carrack expedition w/c8x": "carrack expedition w/c8x",
  "carrack w/c8x": "carrack w/c8x",
  // UTV — RSI lists as just "UTV", DB has "Greycat UTV" (with manufacturer prefix)
  utv: "greycat utv",
};

// --- GraphQL client ---

async function queryGraphQL(
  baseURL: string,
  query: string,
  variables: unknown,
  rateLimitMs: number,
  attempt = 0,
): Promise<BrowseResponse> {
  await delay(rateLimitMs);

  const batch = [{ query, variables }];

  const resp = await fetch(baseURL + GRAPHQL_PATH, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(batch),
  });

  if (resp.status === 429) {
    if (attempt >= MAX_RETRIES) {
      throw new Error(`Rate limited (429) after ${MAX_RETRIES} retries`);
    }
    const retryAfter = parseInt(resp.headers.get("Retry-After") ?? "5", 10);
    await delay(retryAfter * 1000);
    return queryGraphQL(baseURL, query, variables, rateLimitMs, attempt + 1);
  }

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`RSI GraphQL error (HTTP ${resp.status}): ${body.slice(0, 200)}`);
  }

  const responses = (await resp.json()) as GraphQLResponse[];
  if (!responses || responses.length === 0) {
    throw new Error("Empty GraphQL response");
  }

  if (responses[0].errors && responses[0].errors.length > 0) {
    throw new Error(`GraphQL error: ${responses[0].errors[0].message}`);
  }

  if (!responses[0].data) {
    throw new Error("No data in GraphQL response");
  }

  return responses[0].data;
}

// --- Image URL helpers ---

const mediaIDRegex = /media\.robertsspaceindustries\.com\/([^/]+)\//;

function buildImageURLs(url: string): ImageSet {
  const matches = url.match(mediaIDRegex);
  if (matches && matches[1]) {
    const base = "https://media.robertsspaceindustries.com/" + matches[1];
    // Preserve the file extension from the original URL — RSI uses .jpg for most
    // ships but .png for some (e.g. 85X Limited). Defaulting to .jpg causes 404s.
    const ext = url.match(/\.(png)$/i) ? ".png" : ".jpg";
    return {
      imageURL: base + "/store_large" + ext,
      small: base + "/store_small" + ext,
      medium: base + "/store_large" + ext,
      large: base + "/store_hub_large" + ext,
    };
  }

  // New CDN format — use as-is for all sizes
  return { imageURL: url, small: url, medium: url, large: url };
}

// --- Vehicle slug matching ---

export function findVehicleSlug(rsiName: string, nameToSlug: Map<string, string>): string {
  const lower = rsiName.toLowerCase();

  // 1. Check shipNameMap first — explicit overrides take priority over DB name matches.
  //    This ensures entries like "600i touring" → "600i" work even when the DB has
  //    a vehicle named "600i Touring" that would otherwise be matched in step 2.
  const mapped = shipNameMap[lower];
  if (mapped) {
    const slug = nameToSlug.get(mapped);
    if (slug) return slug;
  }

  // 2. Direct name match
  const direct = nameToSlug.get(lower);
  if (direct) return direct;

  // 3. Try removing manufacturer prefix
  const spaceIdx = lower.indexOf(" ");
  if (spaceIdx > 0) {
    const withoutPrefix = lower.substring(spaceIdx + 1);
    const slug = nameToSlug.get(withoutPrefix);
    if (slug) return slug;

    // 4. Apply shipNameMap to the prefix-stripped name
    //    e.g. "Origin 600i Touring" → strip "Origin" → "600i Touring" → map → "600i"
    const reMapped = shipNameMap[withoutPrefix];
    if (reMapped) {
      const slug2 = nameToSlug.get(reMapped);
      if (slug2) return slug2;
    }
  }

  return "";
}

// --- Variant inheritance ---

function findBaseVehicleImages(
  vehicleName: string,
  rsiNameImages: Map<string, ImageSet>,
): ImageSet | null {
  const words = vehicleName.toLowerCase().split(/\s+/);

  // Try progressively shorter prefixes
  for (let length = words.length - 1; length >= 1; length--) {
    const prefix = words.slice(0, length).join(" ");
    const img = rsiNameImages.get(prefix);
    if (img) return img;
  }

  return null;
}

// --- Ship image sync ---

export async function syncShipImages(
  db: D1Database,
  baseURL: string,
  rateLimitMs: number,
): Promise<void> {
  const syncID = await insertSyncHistory(db, SYNC_SOURCE.RSI_API, "ships", "running");

  try {
    console.log("[rsi] Ship image sync starting");

    // Fetch all ships (paginated)
    const allShips: BrowseResource[] = [];
    for (let page = 1; ; page++) {
      const variables = {
        query: {
          page,
          limit: PAGE_LIMIT,
          ships: { all: true },
          sort: { field: "name", direction: "asc" },
        },
      };

      const data = await queryGraphQL(baseURL, browseQuery, variables, rateLimitMs);
      allShips.push(...data.store.listing.resources);

      console.log(
        `[rsi] Ships page ${page}: ${data.store.listing.count} items, ${allShips.length}/${data.store.listing.totalCount} total`,
      );

      if (data.store.listing.count === 0 || allShips.length >= data.store.listing.totalCount) {
        break;
      }
    }

    console.log(`[rsi] Fetched ${allShips.length} ships from RSI API`);

    // Load DB vehicles for matching
    const vehicles = await getAllVehicleNameSlugs(db);
    const nameToSlug = new Map<string, string>();
    for (const v of vehicles) {
      nameToSlug.set(v.name.toLowerCase(), v.slug);
    }

    // slug → images for direct matches
    const slugImages = new Map<string, ImageSet>();
    // RSI name (lowercased) → images for variant inheritance
    const rsiNameImages = new Map<string, ImageSet>();

    let skipped = 0;

    for (const ship of allShips) {
      const name = ship.name || ship.title;
      if (!name) continue;

      const imageURL = ship.media?.thumbnail?.storeSmall;
      if (!imageURL) continue;

      const images = buildImageURLs(imageURL);
      rsiNameImages.set(name.toLowerCase(), images);

      const slug = findVehicleSlug(name, nameToSlug);
      if (!slug) {
        skipped++;
        continue;
      }

      slugImages.set(slug, images);
    }

    // Collect all image update statements for batching
    const stmts: D1PreparedStatement[] = [];

    let matched = 0;
    for (const [slug, img] of slugImages) {
      stmts.push(...buildUpdateVehicleImagesStatement(db, slug, img.imageURL, img.small, img.medium, img.large));
      matched++;
    }

    // Variant inheritance: for unmatched DB vehicles, try base vehicle image
    let inherited = 0;
    for (const v of vehicles) {
      if (slugImages.has(v.slug)) continue;

      // Pass 1: RSI name prefix match (e.g. "Dragonfly Black" prefix for "Dragonfly Star Kitten")
      const baseImg = findBaseVehicleImages(v.name, rsiNameImages);
      if (baseImg) {
        stmts.push(...buildUpdateVehicleImagesStatement(db, v.slug, baseImg.imageURL, baseImg.small, baseImg.medium, baseImg.large));
        inherited++;
        continue;
      }

      // Pass 2: DB name prefix match against vehicles that already have matched images
      // e.g. "Ares Star Fighter Inferno Wikelo War Special" → prefix "ares star fighter inferno" → slug in slugImages
      const words = v.name.toLowerCase().split(/\s+/);
      for (let len = words.length - 1; len >= 1; len--) {
        const prefix = words.slice(0, len).join(" ");
        const baseSlug = nameToSlug.get(prefix);
        if (baseSlug && slugImages.has(baseSlug)) {
          const img = slugImages.get(baseSlug)!;
          stmts.push(...buildUpdateVehicleImagesStatement(db, v.slug, img.imageURL, img.small, img.medium, img.large));
          inherited++;
          break;
        }
      }
    }

    // Execute all updates in batched chunks (D1 limit: 1000 statements per batch)
    for (const chunk of chunkArray(stmts, 500)) {
      await db.batch(chunk);
    }

    const total = matched + inherited;
    await updateSyncHistory(db, syncID, "success", total, "");
    console.log(
      `[rsi] Ship image sync complete: ${matched} matched, ${inherited} inherited, ${skipped} skipped (${allShips.length} RSI ships)`,
    );
    logEvent("sync_rsi_ships", {
      fetched: allShips.length,
      matched,
      inherited,
      skipped,
    });
  } catch (err) {
    await updateSyncHistory(db, syncID, "error", 0, String(err));
    throw err;
  }
}

// --- Ship matrix sync (production status) ---
//
// RSI publishes a public JSON endpoint at /ship-matrix/index listing every
// pledgeable ship with its current production_status ("flight-ready" or
// "in-concept"). This is the authoritative live source — it reflects store
// updates within hours, unlike p4k/DataCore which only changes on patch day.
//
// Our DB stores production_status as an FK to production_statuses which uses
// underscore keys (flight_ready, in_concept). The ship-matrix API uses hyphens.

interface ShipMatrixShip {
  id: number;
  name: string;
  production_status: string;
  chassis_id: number;
}

interface ShipMatrixResponse {
  success: number;
  data: ShipMatrixShip[];
}

const SHIP_MATRIX_URL = "https://robertsspaceindustries.com/ship-matrix/index";

/** Map RSI's status values to our production_statuses.key values. */
function normalizeProductionStatus(rsi: string | null | undefined): string | null {
  if (!rsi) return null;
  const lower = rsi.toLowerCase().trim();
  if (lower === "flight-ready") return "flight_ready";
  if (lower === "in-concept") return "in_concept";
  if (lower === "in-production") return "in_production";
  return null;
}

/**
 * Manufacturer prefixes we strip from DB vehicle names before matching against
 * the ship-matrix API. Ordered longest-first so "Origin Jumpworks" matches
 * before "Origin". Everything is lowercased for comparison.
 */
const MANUFACTURER_PREFIXES = [
  // Multi-word manufacturers first (longest match wins)
  "origin jumpworks",
  "drake interplanetary",
  "anvil aerospace",
  "roberts space industries",
  "consolidated outland",
  "crusader industries",
  "argo astronautics",
  "kruger intergalactic",
  "greycat industrial",
  "banu souli",
  // Single-word manufacturers
  "origin",
  "anvil",
  "drake",
  "aegis",
  "misc",
  "mirai",
  "crusader",
  "argo",
  "tumbril",
  "esperia",
  "atls",
  "kruger",
  "greycat",
  "aopoa",
  "rsi",
  "c.o.",
  "banu",
  "gatac",
  "grey's",
];

/** Strip the leading manufacturer word(s) from a vehicle name. Returns the
 * stripped name (lowercased) + the original name lowercased. */
function stripManufacturerPrefix(name: string): string {
  const lower = name.toLowerCase().replace(/\s+/g, " ").trim();
  for (const prefix of MANUFACTURER_PREFIXES) {
    if (lower.startsWith(prefix + " ")) {
      return lower.substring(prefix.length + 1).trim();
    }
  }
  return lower;
}

/**
 * Fetch the live ship-matrix and update vehicles.production_status_id.
 * Also maintains is_pledgeable: ships found in the matrix are pledgeable (1),
 * ships not found are non-pledgeable variants or mission props (0).
 *
 * Matching strategy:
 *   1. Apply shipNameMap to the RSI name (e.g. "600i Explorer" → "600i")
 *   2. Direct match against DB name (lowercased)
 *   3. Build a "prefix-stripped" index of DB names (e.g. "RSI Aurora Mk I MR" → "aurora mk i mr")
 *      and match against that
 */
export async function syncShipProductionStatus(db: D1Database): Promise<void> {
  const syncID = await insertSyncHistory(
    db,
    SYNC_SOURCE.RSI_API,
    "production_status",
    "running",
  );

  try {
    console.log("[rsi] Ship production status sync starting");

    // Fetch ship-matrix
    const resp = await fetch(SHIP_MATRIX_URL, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });
    if (!resp.ok) {
      throw new Error(`Ship matrix fetch failed: HTTP ${resp.status}`);
    }
    const payload = (await resp.json()) as ShipMatrixResponse;
    if (payload.success !== 1 || !Array.isArray(payload.data)) {
      throw new Error("Ship matrix returned invalid payload");
    }
    const rsiShips = payload.data;
    console.log(`[rsi] Fetched ${rsiShips.length} ships from ship-matrix`);

    // Load all DB vehicles (latest game version) for matching.
    // We need more than just name/slug — we need the id to UPDATE.
    const { results: dbVehicles } = await db
      .prepare(
        `SELECT v.id, v.name, v.slug
           FROM vehicles v
          WHERE v.removed = 0
            AND v.game_version_id = (SELECT id FROM game_versions WHERE is_default = 1)`,
      )
      .all<{ id: number; name: string; slug: string }>();

    // Build lookup indexes.
    // 1. Direct name match (full lowercase name → id)
    const directNameToId = new Map<string, number>();
    // 2. Prefix-stripped name match (bare name → [ids])
    const strippedNameToIds = new Map<string, number[]>();
    // 3. Slug match (slug → id) for final fallback
    const slugToId = new Map<string, number>();

    for (const v of dbVehicles) {
      const fullLower = v.name.toLowerCase().replace(/\s+/g, " ").trim();
      directNameToId.set(fullLower, v.id);

      const stripped = stripManufacturerPrefix(v.name);
      if (stripped !== fullLower) {
        const existing = strippedNameToIds.get(stripped);
        if (existing) {
          existing.push(v.id);
        } else {
          strippedNameToIds.set(stripped, [v.id]);
        }
      }

      if (v.slug) slugToId.set(v.slug.toLowerCase(), v.id);
    }

    // Look up production_status IDs
    const { results: statusRows } = await db
      .prepare(`SELECT id, key FROM production_statuses`)
      .all<{ id: number; key: string }>();
    const statusKeyToId = new Map<string, number>();
    for (const s of statusRows) statusKeyToId.set(s.key, s.id);

    // Match ships and collect updates
    const matchedIds = new Set<number>();
    const updates: Array<{ id: number; statusId: number }> = [];
    let unmatched = 0;
    const unmatchedNames: string[] = [];

    for (const ship of rsiShips) {
      const shipName = (ship.name || "").trim();
      if (!shipName) continue;

      const normalizedStatus = normalizeProductionStatus(ship.production_status);
      if (!normalizedStatus) {
        console.log(
          `[rsi] Skipping ${shipName}: unknown status ${ship.production_status}`,
        );
        continue;
      }
      const statusId = statusKeyToId.get(normalizedStatus);
      if (!statusId) {
        console.log(
          `[rsi] Skipping ${shipName}: no production_statuses row for ${normalizedStatus}`,
        );
        continue;
      }

      // Try each matching strategy in order
      const lower = shipName.toLowerCase().replace(/\s+/g, " ").trim();
      let dbId: number | undefined;

      // 1. shipNameMap override (handles "600i explorer" → "600i" etc.)
      const mapped = shipNameMap[lower];
      if (mapped) {
        dbId = directNameToId.get(mapped);
        if (!dbId) {
          const stripIds = strippedNameToIds.get(mapped);
          if (stripIds && stripIds.length === 1) dbId = stripIds[0];
        }
      }

      // 2. Direct full-name match (rare — RSI names usually don't have manufacturer prefix)
      if (!dbId) dbId = directNameToId.get(lower);

      // 3. Prefix-stripped match (most common path)
      if (!dbId) {
        const stripIds = strippedNameToIds.get(lower);
        if (stripIds && stripIds.length === 1) {
          dbId = stripIds[0];
        } else if (stripIds && stripIds.length > 1) {
          console.log(
            `[rsi] Ambiguous stripped-name match for ${shipName}: ${stripIds.length} candidates`,
          );
        }
      }

      if (!dbId) {
        unmatched++;
        if (unmatchedNames.length < 20) unmatchedNames.push(shipName);
        continue;
      }

      matchedIds.add(dbId);
      updates.push({ id: dbId, statusId });
    }

    console.log(
      `[rsi] Matched ${updates.length}/${rsiShips.length} ship-matrix entries to DB`,
    );
    if (unmatched > 0) {
      console.log(`[rsi] Unmatched RSI ships (${unmatched}): ${unmatchedNames.join(", ")}`);
    }

    // Apply updates in batches. Also mark everything in the DB as pledgeable=1
    // if the column exists (migration may not be applied yet) — we do this in
    // the same batch by including an is_pledgeable update via COALESCE so it's
    // a no-op if the column is missing. Actually simpler: use two passes and
    // tolerate errors on the is_pledgeable path.
    const statements: D1PreparedStatement[] = [];
    for (const u of updates) {
      statements.push(
        db
          .prepare(
            `UPDATE vehicles SET production_status_id = ? WHERE id = ?`,
          )
          .bind(u.statusId, u.id),
      );
    }

    // is_pledgeable: set 1 for matched ships, 0 for unmatched in-game variants.
    // We only touch vehicles in the latest game version. Non-matched ones with
    // UUID (came from p4k) get is_pledgeable=0. NULL-UUID concept ships that
    // didn't match are either mis-named or removed from store — we leave them
    // alone (their existing value wins).
    let pledgeableErrors = 0;
    try {
      const matchedIdList = [...matchedIds];
      if (matchedIdList.length > 0) {
        // Set pledgeable=1 for the matched ones
        const placeholders = matchedIdList.map(() => "?").join(",");
        statements.push(
          db
            .prepare(
              `UPDATE vehicles SET is_pledgeable = 1 WHERE id IN (${placeholders})`,
            )
            .bind(...matchedIdList),
        );
        // Set pledgeable=0 for everything else in the latest version that has a UUID
        // (i.e. came from p4k — so it's a real in-game entity) and wasn't matched.
        statements.push(
          db
            .prepare(
              `UPDATE vehicles SET is_pledgeable = 0
                 WHERE removed = 0
                   AND uuid IS NOT NULL AND uuid != ''
                   AND game_version_id = (SELECT id FROM game_versions WHERE is_default = 1)
                   AND id NOT IN (${placeholders})`,
            )
            .bind(...matchedIdList),
        );
      }
    } catch (err) {
      // is_pledgeable column may not exist yet — count and continue
      pledgeableErrors++;
      console.log(`[rsi] is_pledgeable update skipped: ${err}`);
    }

    // Execute in chunks (D1 batch has a statement limit)
    const chunks = chunkArray(statements, 50);
    for (const chunk of chunks) {
      await db.batch(chunk);
    }

    const detail = `matched=${updates.length} unmatched=${unmatched} fetched=${rsiShips.length}`;
    await updateSyncHistory(db, syncID, "success", updates.length, detail);
    console.log(`[rsi] Ship production status sync complete: ${detail}`);
    logEvent("sync_rsi_production_status", {
      fetched: rsiShips.length,
      matched: updates.length,
      unmatched,
      pledgeable_errors: pledgeableErrors,
    });
  } catch (err) {
    await updateSyncHistory(db, syncID, "error", 0, String(err));
    throw err;
  }
}

// --- Combined sync (ships only — paint images are manual upload) ---

export async function syncAll(
  db: D1Database,
  baseURL: string,
  rateLimitMs: number,
): Promise<void> {
  await syncShipImages(db, baseURL, rateLimitMs);
  await syncShipProductionStatus(db);
}
