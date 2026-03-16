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
  const result = await db
    .prepare(`SELECT v.id, v.slug, v.name FROM vehicles v
      INNER JOIN (
        SELECT slug, MAX(game_version_id) as latest_gv
        FROM vehicles
        WHERE ${VEHICLE_VERSION_CAP}
        GROUP BY slug
      ) _vv ON v.slug = _vv.slug AND v.game_version_id = _vv.latest_gv`)
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
  const maxRow = await db
    .prepare("SELECT MAX(id) as max_id FROM user_fleet WHERE user_id = ?")
    .bind(userID)
    .first<{ max_id: number | null }>();
  const maxExistingId = maxRow?.max_id ?? 0;

  for (let i = 0; i < insertStmts.length; i += 1000) {
    await db.batch(insertStmts.slice(i, i + 1000));
  }

  await db
    .prepare("DELETE FROM user_fleet WHERE user_id = ? AND id <= ?")
    .bind(userID, maxExistingId)
    .run();
}
