/**
 * POI (point-of-interest) slug resolution.
 *
 * SC Bridge has two slug conventions for locations:
 *   1. Container-side slugs from DataCore extraction, e.g. "FloatingIslands",
 *      "Covalex", "Kareah" — used as `location_key` in loot_item_locations.
 *   2. star_map_locations.slug, e.g. "stanton2-orison", "starmapobject.covalexshippinghub"
 *      — the canonical hierarchy-aware identifier used throughout the DB.
 *
 * The two don't always match. For the handful where a container has a
 * corresponding real-world location, the mapping below bridges them so a
 * request for `/api/gamedata/poi/FloatingIslands` can resolve shops + missions
 * that are keyed to `stanton2-orison`.
 *
 * **Why this table stays small** — 2026-04-20 investigation into "scale-out"
 * revealed that of the 128 distinct `location_key` values in
 * loot_item_locations, most are NOT player-visitable POIs. They're CIG's
 * internal loot-table archetype names (e.g. `Kaboos`, `StormBreaker`,
 * `Loot_HighTech`, `DCDelving`, `ColonialOutpost_Outlaw_Large`) — grouping
 * categories, not places. Only 4 container slugs double-purpose as real
 * POIs — and those are the ones below. Auto-populating the map with all 128
 * would produce junk routes ("/poi/Loot_Criminal", "/poi/DCDelving") that
 * mean nothing to players. The hand-maintained table is the right shape
 * until/unless CIG changes how container slugs map to zones.
 *
 * Mirrors `LOCATION_SLUG_MAP` in `frontend/src/lib/lootLocations.js`.
 */

/** Container slug (DataCore form) → canonical star_map_locations slug. */
export const LOCATION_SLUG_MAP: Record<string, string> = {
  Covalex: "starmapobject.covalexshippinghub",
  Jumptown: "stanton2c-druglab-jumptown",
  Kareah: "starmapobject.securitypostkareah",
  FloatingIslands: "stanton2-orison",
};

/**
 * Resolve an incoming slug to the canonical star_map_locations.slug and the
 * original container slug (if the alias was used). Returns both so callers
 * can key shop / mission lookups on `canonical` and loot lookups on
 * `container`.
 *
 * If the slug is not in the alias map, `container` is null and `canonical`
 * equals the input (the backend will try a direct `star_map_locations.slug`
 * lookup next).
 */
export function resolvePOISlug(raw: string): {
  canonical: string;
  container: string | null;
} {
  const aliasTarget = LOCATION_SLUG_MAP[raw];
  if (aliasTarget) {
    return { canonical: aliasTarget, container: raw };
  }
  return { canonical: raw, container: null };
}

/**
 * Reverse lookup: given a canonical slug, find the container slug that
 * aliases to it. Used when a POI request arrives on the canonical slug but
 * the loot_item_locations data is keyed by the container slug.
 */
export function canonicalToContainerSlug(canonical: string): string | null {
  for (const [container, mapped] of Object.entries(LOCATION_SLUG_MAP)) {
    if (mapped === canonical) return container;
  }
  return null;
}
