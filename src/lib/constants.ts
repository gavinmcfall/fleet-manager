/**
 * Shared constants — sync source IDs match seed data in 0001_initial_schema.sql
 */

export const SYNC_SOURCE = {
  HANGARXPLOR: 3,
  SCUNPACKED: 4,
  RSI_API: 5,
} as const;

/**
 * SQL INNER JOIN that resolves vehicles to their latest version at or before
 * the default game version.
 *
 * Without this, vehicle queries would either show duplicates (if vehicles exist
 * in multiple versions) or return nothing (if the default version has no vehicle
 * rows because only loot data was loaded for that patch).
 *
 * Append after `FROM vehicles v` in any user-facing read query.
 */
export const VEHICLE_VERSION_JOIN = `INNER JOIN (
    SELECT slug, MAX(game_version_id) as latest_gv
    FROM vehicles
    WHERE game_version_id <= (SELECT id FROM game_versions WHERE is_default = 1)
    GROUP BY slug
  ) _vv ON v.slug = _vv.slug AND v.game_version_id = _vv.latest_gv`;

/**
 * Version cap for import queries — resolves vehicles at or before the default
 * version (same logic as VEHICLE_VERSION_JOIN but for inline subqueries).
 */
export const VEHICLE_VERSION_CAP = `game_version_id <= (SELECT id FROM game_versions WHERE is_default = 1)`;

/** Version-aware join — accepts optional patch code for user-selected versions.
 * Falls back to the default version if the requested code doesn't exist
 * (e.g. stale PTU codes after version consolidation). */
export function versionSubquery(patchCode?: string): string {
  if (!patchCode) return `(SELECT id FROM game_versions WHERE is_default = 1)`;
  const escaped = patchCode.replace(/'/g, "''");
  return `(SELECT COALESCE(
    (SELECT id FROM game_versions WHERE code = '${escaped}'),
    (SELECT id FROM game_versions WHERE is_default = 1)
  ))`;
}

/**
 * Generic delta-versioned INNER JOIN. Resolves each item to its latest
 * non-removed row at or before the selected game version.
 *
 * Usage: `FROM fps_weapons w ${deltaVersionJoin('fps_weapons', 'w', 'uuid', patchCode)}`
 *
 * @param table     - DB table name
 * @param alias     - table alias used in the outer query
 * @param identityCol - column that identifies the "same item" across versions (usually 'uuid')
 * @param patchCode - optional version code; defaults to the is_default version
 */
export function deltaVersionJoin(
  table: string,
  alias: string,
  identityCol: string = "uuid",
  patchCode?: string,
): string {
  const vq = versionSubquery(patchCode);
  return `INNER JOIN (
    SELECT ${identityCol}, MAX(game_version_id) as latest_gv
    FROM ${table}
    WHERE game_version_id <= ${vq} AND removed = 0
    GROUP BY ${identityCol}
  ) _dv_${alias} ON ${alias}.${identityCol} = _dv_${alias}.${identityCol}
    AND ${alias}.game_version_id = _dv_${alias}.latest_gv`;
}

export function vehicleVersionJoin(patchCode?: string): string {
  return deltaVersionJoin("vehicles", "v", "slug", patchCode);
}

export function vehicleVersionCap(patchCode?: string): string {
  return `game_version_id <= ${versionSubquery(patchCode)}`;
}
