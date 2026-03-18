/**
 * D1 database query functions — ported from internal/database/database.go
 *
 * All queries use D1's prepared statement API: db.prepare(sql).bind(...params)
 * D1 is SQLite-compatible, so we use SQLite syntax throughout.
 */

import type {
  Vehicle,
  Paint,
  UserFleetEntry,
  SyncHistory,
  UserLLMConfig,
  AIAnalysis,
} from "../lib/types";
import { extractSetName, makeSetSlug } from "../lib/loot-sets";
import { VEHICLE_VERSION_JOIN, VEHICLE_VERSION_CAP } from "../lib/constants";

// --- Loot JSON "has_*" column expressions ---
// Reusable SQL fragment for SELECT clauses that compute boolean flags from JSON blob columns.
// Each flag is 1 if the JSON column contains actual data, 0 otherwise.
const LOOT_HAS_FLAGS = `
        EXISTS(SELECT 1 FROM loot_item_locations lil WHERE lil.loot_map_id = lm.id AND lil.source_type = 'container') as has_containers,
        EXISTS(SELECT 1 FROM loot_item_locations lil WHERE lil.loot_map_id = lm.id AND lil.source_type = 'shop') as has_shops,
        EXISTS(SELECT 1 FROM loot_item_locations lil WHERE lil.loot_map_id = lm.id AND lil.source_type = 'npc') as has_npcs,
        EXISTS(SELECT 1 FROM loot_item_locations lil WHERE lil.loot_map_id = lm.id AND lil.source_type = 'contract') as has_contracts`;

// --- Nullable helpers (mirror Go's nullableStr/nullableFloat/nullableInt) ---

function n(val: string | undefined | null): string | null {
  return val ?? null;
}

function nNum(val: number | undefined | null): number | null {
  return val ?? null;
}

export async function getAllVehicles(db: D1Database): Promise<Vehicle[]> {
  const result = await db
    .prepare(
      `SELECT v.id, v.uuid, v.slug, v.name, v.class_name,
        v.size, v.size_label, v.focus, v.classification, v.description,
        v.length, v.beam, v.height, v.mass, v.cargo,
        v.crew_min, v.crew_max, v.speed_scm, v.pledge_price, v.on_sale,
        v.image_url, v.image_url_small, v.image_url_medium, v.image_url_large,
        v.pledge_url,
        m.name as manufacturer_name, m.code as manufacturer_code,
        ps.key as production_status
      FROM vehicles v
      ${VEHICLE_VERSION_JOIN}
      LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
      LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
      ORDER BY v.name`,
    )
    .all();
  return result.results as unknown as Vehicle[];
}

export async function getVehicleBySlug(db: D1Database, slug: string): Promise<Vehicle | null> {
  const row = await db
    .prepare(
      `SELECT v.id, v.uuid, v.slug, v.name, v.class_name,
        v.size, v.size_label, v.focus, v.classification, v.description,
        v.length, v.beam, v.height, v.mass, v.cargo,
        v.crew_min, v.crew_max, v.speed_scm, v.pledge_price, v.on_sale,
        v.image_url, v.image_url_small, v.image_url_medium, v.image_url_large,
        v.pledge_url,
        m.name as manufacturer_name, m.code as manufacturer_code,
        ps.key as production_status
      FROM vehicles v
      ${VEHICLE_VERSION_JOIN}
      LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
      LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
      WHERE v.slug = ?`,
    )
    .bind(slug)
    .first();
  return row as unknown as Vehicle | null;
}

export async function getVehicleCount(db: D1Database): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) as count FROM vehicles v ${VEHICLE_VERSION_JOIN}`).first<{ count: number }>();
  return row?.count ?? 0;
}

export async function getVehicleIDBySlug(db: D1Database, slug: string): Promise<number | null> {
  const row = await db
    .prepare(`SELECT v.id FROM vehicles v ${VEHICLE_VERSION_JOIN} WHERE v.slug = ? LIMIT 1`)
    .bind(slug)
    .first<{ id: number }>();
  return row?.id ?? null;
}

export async function getAllVehicleNameSlugs(
  db: D1Database,
): Promise<Array<{ name: string; slug: string }>> {
  const result = await db.prepare(`SELECT v.name, v.slug FROM vehicles v ${VEHICLE_VERSION_JOIN} ORDER BY v.name`).all();
  return result.results as Array<{ name: string; slug: string }>;
}

export async function updateVehicleImages(
  db: D1Database,
  slug: string,
  imageURL: string,
  small: string,
  medium: string,
  large: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE vehicles SET
        image_url = ?, image_url_small = ?, image_url_medium = ?, image_url_large = ?,
        updated_at = datetime('now')
      WHERE slug = ?`,
    )
    .bind(imageURL, small, medium, large, slug)
    .run();
}

export async function syncVehicleLoaners(
  db: D1Database,
  vehicleID: number,
  loanerSlugs: string[],
): Promise<void> {
  await db.prepare("DELETE FROM vehicle_loaners WHERE vehicle_id = ?").bind(vehicleID).run();

  for (const slug of loanerSlugs) {
    await db
      .prepare(
        "INSERT OR IGNORE INTO vehicle_loaners (vehicle_id, loaner_id) SELECT ?, id FROM vehicles WHERE slug = ?",
      )
      .bind(vehicleID, slug)
      .run();
  }
}

export async function findVehicleIDsBySlugLike(
  db: D1Database,
  pattern: string,
): Promise<number[]> {
  const result = await db
    .prepare(`SELECT v.id FROM vehicles v ${VEHICLE_VERSION_JOIN} WHERE v.slug LIKE ?`)
    .bind(pattern)
    .all();
  return result.results.map((r) => (r as { id: number }).id);
}

export async function findVehicleIDsBySlugPrefix(
  db: D1Database,
  prefix: string,
): Promise<number[]> {
  const result = await db
    .prepare(`SELECT v.id FROM vehicles v ${VEHICLE_VERSION_JOIN} WHERE v.slug LIKE ?`)
    .bind(prefix + "%")
    .all();
  return result.results.map((r) => (r as { id: number }).id);
}

export async function findVehicleIDsByNameContains(
  db: D1Database,
  term: string,
): Promise<number[]> {
  const result = await db
    .prepare(`SELECT v.id FROM vehicles v ${VEHICLE_VERSION_JOIN} WHERE LOWER(v.name) LIKE ?`)
    .bind("%" + term.toLowerCase() + "%")
    .all();
  return result.results.map((r) => (r as { id: number }).id);
}

// ============================================================
// Port Operations
// ============================================================

export async function getShipLoadout(db: D1Database, slug: string): Promise<Record<string, unknown>[]> {
  // Some ships mount weapons inside a weapon-mount bracket (fixed/gimbal). The bracket is
  // the direct equipped item on the gun port, but it is not in vehicle_components. The actual
  // weapon lives one level deeper in a child port. We use a CTE to pre-filter to just this
  // ship's ports, then COALESCE the direct component join with a child-port fallback lookup.
  //
  // port_id and parent_port_id are returned so the frontend can build a hierarchy
  // (e.g. weapon ports nested under their turret housing in the Turrets section).
  const result = await db
    .prepare(
      `WITH ship_ports AS (
        SELECT * FROM vehicle_ports
        WHERE vehicle_id = (SELECT v.id FROM vehicles v ${VEHICLE_VERSION_JOIN} WHERE v.slug = ?)
      ),
      child_components AS (
        SELECT
          c.parent_port_id,
          vc2.name, vc2.type, vc2.sub_type, vc2.size, vc2.grade, vc2.class,
          vc2.power_output, vc2.overpower_performance, vc2.overclock_performance,
          vc2.overclock_threshold_min, vc2.overclock_threshold_max, vc2.thermal_output,
          vc2.cooling_rate, vc2.max_temperature, vc2.overheat_temperature,
          vc2.shield_hp, vc2.shield_regen, vc2.resist_physical, vc2.resist_energy,
          vc2.resist_distortion, vc2.resist_thermal, vc2.regen_delay, vc2.downed_regen_delay,
          vc2.quantum_speed, vc2.quantum_range, vc2.fuel_rate, vc2.spool_time,
          vc2.cooldown_time, vc2.stage1_accel, vc2.stage2_accel,
          vc2.rounds_per_minute, vc2.ammo_container_size, vc2.damage_per_shot,
          vc2.damage_type, vc2.projectile_speed, vc2.effective_range, vc2.dps,
          vc2.heat_per_shot, vc2.power_draw, vc2.fire_modes,
          vc2.rotation_speed, vc2.min_pitch, vc2.max_pitch, vc2.min_yaw, vc2.max_yaw, vc2.gimbal_type,
          vc2.thrust_force, vc2.fuel_burn_rate, vc2.radar_range, vc2.radar_angle,
          vc2.qed_range, vc2.qed_strength,
          m2.name AS manufacturer_name, m2.class AS manufacturer_class,
          ROW_NUMBER() OVER (PARTITION BY c.parent_port_id ORDER BY c.id) AS rn
        FROM ship_ports c
        JOIN vehicle_components vc2 ON vc2.uuid = c.equipped_item_uuid
        LEFT JOIN manufacturers m2 ON m2.id = vc2.manufacturer_id
      )
      SELECT
        p.id AS port_id,
        p.parent_port_id,
        p.name AS port_name,
        p.category_label,
        p.port_type,
        p.size_min,
        p.size_max,
        COALESCE(vc.name, child.name) AS component_name,
        COALESCE(vc.type, child.type) AS component_type,
        COALESCE(vc.sub_type, child.sub_type) AS sub_type,
        COALESCE(vc.size, child.size) AS component_size,
        COALESCE(vc.grade, child.grade) AS grade,
        COALESCE(vc.power_output, child.power_output) AS power_output,
        COALESCE(vc.overpower_performance, child.overpower_performance) AS overpower_performance,
        COALESCE(vc.overclock_performance, child.overclock_performance) AS overclock_performance,
        COALESCE(vc.overclock_threshold_min, child.overclock_threshold_min) AS overclock_threshold_min,
        COALESCE(vc.overclock_threshold_max, child.overclock_threshold_max) AS overclock_threshold_max,
        COALESCE(vc.thermal_output, child.thermal_output) AS thermal_output,
        COALESCE(vc.cooling_rate, child.cooling_rate) AS cooling_rate,
        COALESCE(vc.max_temperature, child.max_temperature) AS max_temperature,
        COALESCE(vc.overheat_temperature, child.overheat_temperature) AS overheat_temperature,
        COALESCE(vc.shield_hp, child.shield_hp) AS shield_hp,
        COALESCE(vc.shield_regen, child.shield_regen) AS shield_regen,
        COALESCE(vc.resist_physical, child.resist_physical) AS resist_physical,
        COALESCE(vc.resist_energy, child.resist_energy) AS resist_energy,
        COALESCE(vc.resist_distortion, child.resist_distortion) AS resist_distortion,
        COALESCE(vc.resist_thermal, child.resist_thermal) AS resist_thermal,
        COALESCE(vc.regen_delay, child.regen_delay) AS regen_delay,
        COALESCE(vc.downed_regen_delay, child.downed_regen_delay) AS downed_regen_delay,
        COALESCE(vc.quantum_speed, child.quantum_speed) AS quantum_speed,
        COALESCE(vc.quantum_range, child.quantum_range) AS quantum_range,
        COALESCE(vc.fuel_rate, child.fuel_rate) AS fuel_rate,
        COALESCE(vc.spool_time, child.spool_time) AS spool_time,
        COALESCE(vc.cooldown_time, child.cooldown_time) AS cooldown_time,
        COALESCE(vc.stage1_accel, child.stage1_accel) AS stage1_accel,
        COALESCE(vc.stage2_accel, child.stage2_accel) AS stage2_accel,
        COALESCE(vc.rounds_per_minute, child.rounds_per_minute) AS rounds_per_minute,
        COALESCE(vc.ammo_container_size, child.ammo_container_size) AS ammo_container_size,
        COALESCE(vc.damage_per_shot, child.damage_per_shot) AS damage_per_shot,
        COALESCE(vc.damage_type, child.damage_type) AS damage_type,
        COALESCE(vc.projectile_speed, child.projectile_speed) AS projectile_speed,
        COALESCE(vc.effective_range, child.effective_range) AS effective_range,
        COALESCE(vc.dps, child.dps) AS dps,
        COALESCE(vc.heat_per_shot, child.heat_per_shot) AS heat_per_shot,
        COALESCE(vc.power_draw, child.power_draw) AS power_draw,
        COALESCE(vc.fire_modes, child.fire_modes) AS fire_modes,
        COALESCE(vc.rotation_speed, child.rotation_speed) AS rotation_speed,
        COALESCE(vc.min_pitch, child.min_pitch) AS min_pitch,
        COALESCE(vc.max_pitch, child.max_pitch) AS max_pitch,
        COALESCE(vc.min_yaw, child.min_yaw) AS min_yaw,
        COALESCE(vc.max_yaw, child.max_yaw) AS max_yaw,
        COALESCE(vc.gimbal_type, child.gimbal_type) AS gimbal_type,
        COALESCE(vc.thrust_force, child.thrust_force) AS thrust_force,
        COALESCE(vc.fuel_burn_rate, child.fuel_burn_rate) AS fuel_burn_rate,
        COALESCE(vc.radar_range, child.radar_range) AS radar_range,
        COALESCE(vc.radar_angle, child.radar_angle) AS radar_angle,
        COALESCE(vc.qed_range, child.qed_range) AS qed_range,
        COALESCE(vc.qed_strength, child.qed_strength) AS qed_strength,
        COALESCE(m.name, child.manufacturer_name) AS manufacturer_name,
        COALESCE(vc.class, m.class, child.class, child.manufacturer_class) AS component_class
      FROM ship_ports p
      LEFT JOIN vehicle_components vc ON vc.uuid = p.equipped_item_uuid
      LEFT JOIN manufacturers m ON m.id = vc.manufacturer_id
      LEFT JOIN child_components child ON child.parent_port_id = p.id AND child.rn = 1
      WHERE p.category_label IS NOT NULL
        AND (
          p.parent_port_id IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM ship_ports pp
            WHERE pp.id = p.parent_port_id
              AND pp.category_label = p.category_label
              AND pp.port_type != 'turret'
          )
        )
      ORDER BY p.category_label, p.name`,
    )
    .bind(slug)
    .all();

  return result.results as Record<string, unknown>[];
}

// ============================================================
// Paint Operations
// ============================================================

export async function upsertPaint(
  db: D1Database,
  p: Partial<Paint> & { name: string },
): Promise<number> {
  await db
    .prepare(
      `INSERT INTO paints (uuid, name, slug, class_name, description,
        image_url, image_url_small, image_url_medium, image_url_large, raw_data, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(class_name) DO UPDATE SET
        name=excluded.name,
        slug=COALESCE(excluded.slug, paints.slug),
        description=COALESCE(excluded.description, paints.description),
        image_url=COALESCE(excluded.image_url, paints.image_url),
        image_url_small=COALESCE(excluded.image_url_small, paints.image_url_small),
        image_url_medium=COALESCE(excluded.image_url_medium, paints.image_url_medium),
        image_url_large=COALESCE(excluded.image_url_large, paints.image_url_large),
        raw_data=COALESCE(excluded.raw_data, paints.raw_data),
        updated_at=excluded.updated_at`,
    )
    .bind(
      n(p.uuid), p.name, n(p.slug), n(p.class_name), n(p.description),
      n(p.image_url), n(p.image_url_small), n(p.image_url_medium), n(p.image_url_large),
      null,
    )
    .run();

  // Always SELECT — D1's last_row_id is unreliable on upsert UPDATE path
  const row = await db
    .prepare("SELECT id FROM paints WHERE class_name = ?")
    .bind(p.class_name)
    .first<{ id: number }>();
  return row?.id ?? 0;
}

export async function getAllPaints(db: D1Database): Promise<Paint[]> {
  const paintResult = await db
    .prepare(
      `SELECT p.id, p.uuid, p.name, p.slug, p.class_name,
        p.description, p.image_url, p.image_url_small, p.image_url_medium, p.image_url_large,
        p.created_at, p.updated_at
      FROM paints p WHERE p.is_base_variant = 0 ORDER BY p.name`,
    )
    .all();

  const paints: Paint[] = paintResult.results.map((row) => ({
    ...(row as unknown as Paint),
    vehicles: [],
  }));

  if (paints.length === 0) return paints;

  const paintIdx = new Map<number, number>();
  paints.forEach((p, i) => paintIdx.set(p.id, i));

  const vResult = await db
    .prepare(
      `SELECT pv.paint_id, v.id, v.name, v.slug
      FROM paint_vehicles pv
      JOIN vehicles v ON v.id = pv.vehicle_id
      ORDER BY pv.paint_id, v.name`,
    )
    .all();

  for (const row of vResult.results) {
    const r = row as { paint_id: number; id: number; name: string; slug: string };
    const idx = paintIdx.get(r.paint_id);
    if (idx !== undefined) {
      paints[idx].vehicles.push({ id: r.id, name: r.name, slug: r.slug });
    }
  }

  return paints;
}

export async function getPaintsForVehicle(db: D1Database, vehicleSlug: string): Promise<Paint[]> {
  const paintResult = await db
    .prepare(
      `SELECT p.id, p.uuid, p.name, p.slug, p.class_name,
        p.description, p.image_url, p.image_url_small, p.image_url_medium, p.image_url_large,
        p.created_at, p.updated_at
      FROM paints p
      WHERE p.is_base_variant = 0 AND p.id IN (
        SELECT pv.paint_id FROM paint_vehicles pv
        JOIN vehicles v ON v.id = pv.vehicle_id
        WHERE v.slug = ?
      )
      ORDER BY p.name`,
    )
    .bind(vehicleSlug)
    .all();

  const paints: Paint[] = paintResult.results.map((row) => ({
    ...(row as unknown as Paint),
    vehicles: [],
  }));

  if (paints.length === 0) return paints;

  const paintIdx = new Map<number, number>();
  paints.forEach((p, i) => paintIdx.set(p.id, i));

  const paintIDs = paints.map((p) => p.id);
  const placeholders = paintIDs.map(() => "?").join(",");
  const vResult = await db
    .prepare(
      `SELECT pv.paint_id, v.id, v.name, v.slug
      FROM paint_vehicles pv
      JOIN vehicles v ON v.id = pv.vehicle_id
      WHERE pv.paint_id IN (${placeholders})
      ORDER BY pv.paint_id, v.name`,
    )
    .bind(...paintIDs)
    .all();

  for (const row of vResult.results) {
    const r = row as { paint_id: number; id: number; name: string; slug: string };
    const idx = paintIdx.get(r.paint_id);
    if (idx !== undefined) {
      paints[idx].vehicles.push({ id: r.id, name: r.name, slug: r.slug });
    }
  }

  return paints;
}

export async function getPaintCount(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) as count FROM paints WHERE is_base_variant = 0").first<{ count: number }>();
  return row?.count ?? 0;
}

export async function updatePaintImages(
  db: D1Database,
  className: string,
  imageURL: string,
  small: string,
  medium: string,
  large: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE paints SET
        image_url = ?, image_url_small = ?, image_url_medium = ?, image_url_large = ?,
        updated_at = datetime('now')
      WHERE class_name = ?`,
    )
    .bind(imageURL, small, medium, large, className)
    .run();
}

export async function getPaintsByVehicleSlug(
  db: D1Database,
  vehicleSlug: string,
): Promise<Array<{ name: string; class_name: string }>> {
  const result = await db
    .prepare(
      `SELECT p.name, p.class_name
      FROM paints p
      JOIN paint_vehicles pv ON pv.paint_id = p.id
      JOIN vehicles v ON v.id = pv.vehicle_id
      WHERE p.is_base_variant = 0 AND v.slug = ?
      ORDER BY p.name`,
    )
    .bind(vehicleSlug)
    .all();
  return result.results as Array<{ name: string; class_name: string }>;
}

export async function getVehicleSlugsWithPaints(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT DISTINCT v.slug
      FROM paint_vehicles pv
      JOIN vehicles v ON v.id = pv.vehicle_id
      JOIN paints p ON p.id = pv.paint_id
      WHERE p.is_base_variant = 0
      ORDER BY v.slug`,
    )
    .all();
  return result.results.map((r) => (r as { slug: string }).slug);
}

// ============================================================
// User Fleet Operations
// ============================================================

export async function insertUserFleetEntry(
  db: D1Database,
  entry: Partial<UserFleetEntry> & { user_id: number; vehicle_id: number },
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO user_fleet (user_id, vehicle_id, insurance_type_id, warbond, is_loaner,
        pledge_id, pledge_name, pledge_cost, pledge_date, custom_name, equipped_paint_id, imported_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .bind(
      entry.user_id, entry.vehicle_id, nNum(entry.insurance_type_id),
      entry.warbond ? 1 : 0, entry.is_loaner ? 1 : 0,
      n(entry.pledge_id), n(entry.pledge_name), n(entry.pledge_cost),
      n(entry.pledge_date), n(entry.custom_name), nNum(entry.equipped_paint_id),
    )
    .run();

  return result.meta.last_row_id ?? 0;
}

export async function clearUserFleet(db: D1Database, userID: number): Promise<void> {
  await db.prepare("DELETE FROM user_fleet WHERE user_id = ?").bind(userID).run();
}

export async function getUserFleetCount(db: D1Database, userID: number): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) as count FROM user_fleet WHERE user_id = ?")
    .bind(userID)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function getUserFleet(db: D1Database, userID: number): Promise<UserFleetEntry[]> {
  const result = await db
    .prepare(
      `SELECT uf.id, uf.user_id, uf.vehicle_id, uf.insurance_type_id, uf.warbond, uf.is_loaner,
        uf.pledge_id, uf.pledge_name, uf.pledge_cost, uf.pledge_date, uf.custom_name,
        uf.equipped_paint_id, uf.imported_at,
        v.name as vehicle_name, v.slug as vehicle_slug, v.image_url, v.focus, v.size_label, v.cargo,
        v.crew_min, v.crew_max, v.pledge_price, v.speed_scm, v.classification,
        m.name as manufacturer_name, m.code as manufacturer_code,
        it.label as insurance_label, it.duration_months, it.is_lifetime,
        p.name as paint_name,
        ps.key as production_status
      FROM user_fleet uf
      JOIN vehicles v ON v.id = uf.vehicle_id
      LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
      LEFT JOIN insurance_types it ON it.id = uf.insurance_type_id
      LEFT JOIN paints p ON p.id = uf.equipped_paint_id
      LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
      WHERE uf.user_id = ?
      ORDER BY v.name`,
    )
    .bind(userID)
    .all();

  return result.results as unknown as UserFleetEntry[];
}

// ============================================================
// Insurance Type Operations
// ============================================================

export async function getInsuranceTypeIDByKey(db: D1Database, key: string): Promise<number | null> {
  const row = await db
    .prepare("SELECT id FROM insurance_types WHERE key = ?")
    .bind(key)
    .first<{ id: number }>();
  return row?.id ?? null;
}

export async function loadInsuranceTypes(db: D1Database): Promise<Map<string, number>> {
  const result = await db.prepare("SELECT id, key FROM insurance_types").all();
  const map = new Map<string, number>();
  for (const row of result.results) {
    const r = row as { id: number; key: string };
    map.set(r.key, r.id);
  }
  return map;
}

// --- Fleet queries ---

/**
 * Fleet query for analysis: vehicle characteristics + insurance, no paint or visibility fields.
 * Used by gap analysis and LLM analysis endpoints.
 */
export async function getFleetForAnalysis(db: D1Database, userId: string): Promise<UserFleetEntry[]> {
  const result = await db
    .prepare(
      `SELECT uf.id, uf.vehicle_id, uf.warbond, uf.is_loaner,
        uf.pledge_id, uf.pledge_name, uf.pledge_cost, uf.pledge_date, uf.custom_name,
        v.name as vehicle_name, v.slug as vehicle_slug, v.focus, v.size_label, v.cargo,
        v.crew_min, v.crew_max, v.pledge_price, v.speed_scm, v.classification,
        m.name as manufacturer_name, m.code as manufacturer_code,
        it.label as insurance_label, it.duration_months, it.is_lifetime,
        ps.key as production_status
      FROM user_fleet uf
      JOIN vehicles v ON v.id = uf.vehicle_id
      LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
      LEFT JOIN insurance_types it ON it.id = uf.insurance_type_id
      LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
      WHERE uf.user_id = ?
      ORDER BY v.name`,
    )
    .bind(userId)
    .all();
  return result.results as unknown as UserFleetEntry[];
}

// ============================================================
// Sync History Operations
// ============================================================

export async function insertSyncHistory(
  db: D1Database,
  sourceID: number,
  endpoint: string,
  status: string,
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO sync_history (source_id, endpoint, status, started_at) VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`,
    )
    .bind(sourceID, endpoint, status)
    .run();
  return result.meta.last_row_id ?? 0;
}

export async function updateSyncHistory(
  db: D1Database,
  id: number,
  status: string,
  count: number,
  errMsg: string,
): Promise<void> {
  await db
    .prepare(
      "UPDATE sync_history SET status = ?, record_count = ?, error_message = ?, completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
    )
    .bind(status, count, errMsg || null, id)
    .run();
}

export async function getLatestSyncHistory(db: D1Database): Promise<SyncHistory[]> {
  const result = await db
    .prepare(
      `SELECT sh.id, sh.source_id, sh.endpoint, sh.status, sh.record_count,
        sh.error_message, sh.started_at, sh.completed_at,
        ss.label as source_label
      FROM sync_history sh
      LEFT JOIN sync_sources ss ON ss.id = sh.source_id
      ORDER BY sh.started_at DESC LIMIT 10`,
    )
    .all();
  return result.results as unknown as SyncHistory[];
}

// ============================================================
// User LLM Config Operations
// ============================================================

export async function getUserLLMConfig(db: D1Database, userID: number): Promise<UserLLMConfig | null> {
  const row = await db
    .prepare("SELECT id, user_id, provider, encrypted_api_key, model FROM user_llm_configs WHERE user_id = ? LIMIT 1")
    .bind(userID)
    .first();
  return row as unknown as UserLLMConfig | null;
}

export async function upsertUserLLMConfig(
  db: D1Database,
  userID: number,
  provider: string,
  encryptedKey: string,
  model: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_llm_configs (user_id, provider, encrypted_api_key, model, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, provider) DO UPDATE SET
        encrypted_api_key=excluded.encrypted_api_key,
        model=excluded.model,
        updated_at=excluded.updated_at`,
    )
    .bind(userID, provider, encryptedKey, model)
    .run();
}

export async function clearUserLLMConfigs(db: D1Database, userID: number): Promise<void> {
  await db.prepare("DELETE FROM user_llm_configs WHERE user_id = ?").bind(userID).run();
}

// ============================================================
// AI Analysis Operations
// ============================================================

export async function saveAIAnalysis(
  db: D1Database,
  userID: number,
  provider: string,
  model: string,
  vehicleCount: number,
  analysis: string,
): Promise<number> {
  const result = await db
    .prepare("INSERT INTO ai_analyses (user_id, provider, model, vehicle_count, analysis) VALUES (?, ?, ?, ?, ?)")
    .bind(userID, provider, model, vehicleCount, analysis)
    .run();
  return result.meta.last_row_id ?? 0;
}

export async function getLatestAIAnalysis(db: D1Database, userID: number): Promise<AIAnalysis | null> {
  const row = await db
    .prepare(
      "SELECT id, user_id, created_at, provider, model, vehicle_count, analysis FROM ai_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .bind(userID)
    .first();
  return row as unknown as AIAnalysis | null;
}

export async function getAIAnalysisHistory(db: D1Database, userID: number, limit = 50): Promise<AIAnalysis[]> {
  const result = await db
    .prepare(
      `SELECT id, user_id, created_at, provider, model, vehicle_count, analysis
      FROM ai_analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(userID, limit)
    .all();
  return result.results as unknown as AIAnalysis[];
}

export async function deleteAIAnalysis(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM ai_analyses WHERE id = ?").bind(id).run();
}

// ============================================================
// Loot Map Operations
// ============================================================

export interface LootItem {
  id: number;
  uuid: string;
  name: string;
  type: string | null;
  sub_type: string | null;
  rarity: string | null;
  category: string;
  has_containers: number;
  has_shops: number;
  has_npcs: number;
  has_contracts: number;
  manufacturer_name: string | null;
}

export interface WishlistItem extends LootItem {
  locations?: {
    containers: Record<string, unknown>[];
    shops: Record<string, unknown>[];
    npcs: Record<string, unknown>[];
    contracts: Record<string, unknown>[];
  };
  wishlist_quantity: number;
}

export interface CollectionEntry {
  loot_map_id: number;
  quantity: number;
}

export async function getGameVersions(db: D1Database): Promise<{ code: string; channel: string; is_default: number; released_at: string }[]> {
  const result = await db
    .prepare(`SELECT gv.code, gv.channel, gv.is_default, gv.released_at
      FROM game_versions gv
      WHERE gv.id <= (SELECT MAX(gv2.id) FROM game_versions gv2
        WHERE EXISTS (SELECT 1 FROM loot_map lm WHERE lm.game_version_id = gv2.id))
        AND (gv.is_default = 1 OR gv.released_at IS NOT NULL OR gv.channel = 'PTU' OR gv.channel = 'EPTU')
      ORDER BY gv.id DESC`)
    .all<{ code: string; channel: string; is_default: number; released_at: string }>();
  return result.results;
}

/**
 * Generates SQL fragments for "latest as of" version resolution.
 *
 * Instead of requiring every item to have a row for the target version,
 * this resolves the most recent row per uuid at or before the target version.
 * Items unchanged since an earlier patch are still returned.
 *
 * Returns { join, where, bind } where:
 *   - join: INNER JOIN clause to append after FROM loot_map lm
 *   - where: version part of WHERE (always 'lm.removed = 0')
 *   - params: bind parameters to spread (empty array or [patchCode])
 */
function latestAsOf(patchCode?: string): { join: string; where: string; params: unknown[] } {
  const versionCap = patchCode
    ? `(SELECT id FROM game_versions WHERE code = ?)`
    : `(SELECT id FROM game_versions WHERE is_default = 1)`;
  return {
    join: `INNER JOIN (
      SELECT uuid, MAX(game_version_id) as latest_gv
      FROM loot_map
      WHERE game_version_id <= ${versionCap}
        AND removed = 0
      GROUP BY uuid
    ) _lv ON lm.uuid = _lv.uuid AND lm.game_version_id = _lv.latest_gv`,
    where: `lm.removed = 0`,
    params: patchCode ? [patchCode] : [],
  };
}

export async function getLootItems(db: D1Database, patchCode?: string): Promise<LootItem[]> {
  const lv = latestAsOf(patchCode);
  const sql = `SELECT lm.id, lm.uuid, lm.name, lm.type, lm.sub_type, lm.rarity,
        lm.category, lm.manufacturer_name,
        ${LOOT_HAS_FLAGS}
      FROM loot_map lm
      ${lv.join}
      WHERE ${lv.where}
        AND lm.name NOT IN ('<= PLACEHOLDER =>')
        AND lm.name NOT LIKE 'EntityClassDefinition.%'
        AND lm.type IS NOT NULL AND lm.type != ''
        AND lm.type NOT IN (
          'NOITEM_Vehicle','UNDEFINED',
          'Char_Skin_Color','Char_Head_Hair','Char_Hair_Color',
          'Char_Head_Eyes','Char_Body','Char_Head_Eyelash',
          'Currency','MobiGlas'
        )
      ORDER BY lm.name ASC`;
  const result = await db.prepare(sql).bind(...lv.params).all();
  return result.results as unknown as LootItem[];
}

export async function getLootByUuid(db: D1Database, uuid: string, patchCode?: string): Promise<Record<string, unknown> | null> {
  const lv = latestAsOf(patchCode);
  const sql = `SELECT lm.*
      FROM loot_map lm
      ${lv.join}
      WHERE lm.uuid = ? AND ${lv.where}`;
  const row = await db.prepare(sql).bind(...lv.params, uuid).first();
  if (!row) return null;

  // Version subquery for detail lookups — must match the same version as the loot_map row
  const versionSub = patchCode
    ? `(SELECT id FROM game_versions WHERE code = ?)`
    : `(SELECT id FROM game_versions WHERE is_default = 1)`;
  const versionParams: unknown[] = patchCode ? [patchCode] : [];

  // Fetch linked item details based on which FK is set
  const item = row as Record<string, unknown>;
  let details: Record<string, unknown> | null = null;

  if (item.fps_weapon_id) {
    details = await db
      .prepare(`SELECT fw.name, fw.sub_type as type, fw.size, fw.description,
        fw.rounds_per_minute, fw.fire_modes, fw.burst_count, fw.ammo_capacity,
        fw.zoom_factor, fw.item_port_count, fw.damage, fw.damage_type,
        fw.projectile_speed, fw.effective_range, fw.dps,
        COALESCE(fa.display_name, fa.name) as magazine_name, fa.magazine_capacity as magazine_size,
        mag_lm.uuid as magazine_loot_uuid
        FROM fps_weapons fw
        LEFT JOIN fps_ammo_types fa ON fa.uuid = fw.magazine_uuid
          AND fa.game_version_id = ${versionSub}
        LEFT JOIN loot_map mag_lm ON mag_lm.uuid = fw.magazine_uuid AND mag_lm.removed = 0
        WHERE fw.id = ?`)
      .bind(...versionParams, item.fps_weapon_id)
      .first() as Record<string, unknown> | null;
  } else if (item.fps_armour_id) {
    details = await db
      .prepare("SELECT name, sub_type as type, size, grade, description, resist_physical, resist_energy, resist_distortion, resist_thermal, resist_biochemical, resist_stun, ir_emission, em_emission, item_port_count FROM fps_armour WHERE id = ?")
      .bind(item.fps_armour_id)
      .first() as Record<string, unknown> | null;
  } else if (item.fps_attachment_id) {
    details = await db
      .prepare("SELECT name, sub_type as type, size, description, zoom_scale, second_zoom_scale, damage_multiplier, sound_radius_multiplier FROM fps_attachments WHERE id = ?")
      .bind(item.fps_attachment_id)
      .first() as Record<string, unknown> | null;
  } else if (item.fps_utility_id) {
    details = await db
      .prepare("SELECT name, sub_type as type, description, heal_amount, effect_duration, consumable_type, damage, blast_radius, fuse_time, device_type FROM fps_utilities WHERE id = ?")
      .bind(item.fps_utility_id)
      .first() as Record<string, unknown> | null;
  } else if (item.fps_helmet_id) {
    details = await db
      .prepare("SELECT name, sub_type as type, size, grade, description, resist_physical, resist_energy, resist_distortion, resist_thermal, resist_biochemical, resist_stun, ir_emission, em_emission, item_port_count, atmosphere_capacity FROM fps_helmets WHERE id = ?")
      .bind(item.fps_helmet_id)
      .first() as Record<string, unknown> | null;
  } else if (item.fps_clothing_id) {
    details = await db
      .prepare("SELECT name, slot, size, grade, description, resist_physical, resist_energy, resist_distortion, resist_thermal, resist_biochemical, resist_stun, ir_emission, em_emission, storage_capacity, temperature_range_min, temperature_range_max FROM fps_clothing WHERE id = ?")
      .bind(item.fps_clothing_id)
      .first() as Record<string, unknown> | null;
  } else if (item.consumable_id) {
    details = await db
      .prepare("SELECT name, type, sub_type, description, uuid FROM consumables WHERE id = ?")
      .bind(item.consumable_id)
      .first() as Record<string, unknown> | null;
    if (details?.uuid) {
      const effects = await db
        .prepare(`SELECT effect_key, magnitude, duration_seconds FROM consumable_effects WHERE consumable_uuid = ? AND game_version_id = ${versionSub}`)
        .bind(details.uuid as string, ...versionParams)
        .all();
      (details as Record<string, unknown>).effects = effects.results;
      delete (details as Record<string, unknown>).uuid;
    }
  }

  // Fallback: magazines have no FK from loot_map — match by UUID to fps_ammo_types
  if (!details && item.sub_type === 'Magazine') {
    details = await db
      .prepare(`SELECT COALESCE(display_name, name) as name, caliber, damage_per_round, damage_type, projectile_speed, magazine_capacity FROM fps_ammo_types WHERE uuid = ? AND game_version_id = ${versionSub}`)
      .bind(uuid, ...versionParams)
      .first() as Record<string, unknown> | null;
  }

  // Fallback: fetch consumable effects directly by loot_map UUID when consumable_id FK is null
  // (medical pens exist in consumable_effects but not in the consumables table)
  if (!details?.effects && (item.type === 'FPS_Consumable' || item.category === 'Consumable')) {
    const effects = await db
      .prepare(`SELECT effect_key, magnitude, duration_seconds FROM consumable_effects WHERE consumable_uuid = ? AND game_version_id = ${versionSub}`)
      .bind(uuid, ...versionParams)
      .all();
    if (effects.results.length > 0) {
      if (!details) details = { name: item.name as string, type: item.type as string, sub_type: item.sub_type as string, description: item.description as string };
      (details as Record<string, unknown>).effects = effects.results;
    }
  }

  if (item.harvestable_id) {
    details = await db
      .prepare("SELECT name, sub_type as type, description FROM harvestables WHERE id = ?")
      .bind(item.harvestable_id)
      .first() as Record<string, unknown> | null;
  } else if (item.props_id) {
    details = await db
      .prepare("SELECT name, type, sub_type, description FROM props WHERE id = ?")
      .bind(item.props_id)
      .first() as Record<string, unknown> | null;
  } else if (item.vehicle_component_id) {
    details = await db
      .prepare("SELECT name, type, sub_type, size, grade, description, power_output, overpower_performance, overclock_performance, overclock_threshold_min, overclock_threshold_max, thermal_output, cooling_rate, max_temperature, overheat_temperature, shield_hp, shield_regen, resist_physical, resist_energy, resist_distortion, resist_thermal, regen_delay, downed_regen_delay, quantum_speed, quantum_range, fuel_rate, spool_time, cooldown_time, stage1_accel, stage2_accel, rounds_per_minute, ammo_container_size, damage_per_shot, damage_type, projectile_speed, effective_range, dps, heat_per_shot, power_draw, fire_modes, rotation_speed, min_pitch, max_pitch, min_yaw, max_yaw, gimbal_type, thrust_force, fuel_burn_rate, radar_range, radar_angle, qed_range, qed_strength FROM vehicle_components WHERE id = ?")
      .bind(item.vehicle_component_id)
      .first() as Record<string, unknown> | null;
  } else if (item.ship_missile_id) {
    details = await db
      .prepare("SELECT name, type, sub_type, size, grade, description, missile_type, lock_time, tracking_signal, damage, damage_type, blast_radius, speed, lock_range, ammo_count FROM ship_missiles WHERE id = ?")
      .bind(item.ship_missile_id)
      .first() as Record<string, unknown> | null;
  }

  // Fetch locations from junction table
  const locations = await db.prepare(`
    SELECT source_type, location_key, location_tag, container_type,
      per_container, per_roll, rolls, loot_table,
      buy_price, sell_price,
      actor, faction, slot, probability, spawn_locations,
      contract_name, guild, reward_type, amount, weight
    FROM loot_item_locations WHERE loot_map_id = ?
    ORDER BY source_type, location_key
  `).bind(item.id).all();

  const locationsByType: Record<string, Record<string, unknown>[]> = { containers: [], shops: [], npcs: [], contracts: [] };
  for (const loc of locations.results) {
    const r = loc as Record<string, unknown>;
    const key = (r.source_type as string) + 's'; // container→containers
    if (locationsByType[key]) locationsByType[key].push(r);
  }

  // Enrich with NPC loadout data — which NPCs wear/carry this item
  const className = item.class_name as string;
  if (className) {
    const itemName = className.replace(/^EntityClassDefinition\./, '');
    const npcLoadouts = await db.prepare(`
      SELECT nl.loadout_name, nf.name as faction_name, nf.code as faction_code,
             nli.port_name, nli.tag
      FROM npc_loadout_items nli
      JOIN npc_loadouts nl ON nl.id = nli.loadout_id
      JOIN npc_factions nf ON nf.id = nl.faction_id
      WHERE nli.item_name = ?
        AND nl.game_version_id = ${versionSub}
      ORDER BY nf.name, nl.loadout_name
    `).bind(itemName, ...versionParams).all();

    if (npcLoadouts.results.length > 0) {
      for (const npc of npcLoadouts.results) {
        const r = npc as Record<string, unknown>;
        locationsByType.npcs.push({
          source_type: 'npc',
          location_key: r.faction_name,
          actor: r.loadout_name,
          faction: r.faction_name,
          faction_code: r.faction_code,
          slot: r.port_name,
          probability: null,
          from_loadout: true,
        });
      }
    }
  }

  return { ...item, locations: locationsByType, item_details: details };
}

export async function getUserLootCollection(db: D1Database, userId: string): Promise<CollectionEntry[]> {
  const result = await db
    .prepare("SELECT loot_map_id, quantity FROM user_loot_collection WHERE user_id = ?")
    .bind(userId)
    .all<CollectionEntry>();
  return result.results;
}

export async function addToLootCollection(db: D1Database, userId: string, lootMapId: number): Promise<void> {
  await db
    .prepare("INSERT OR IGNORE INTO user_loot_collection (user_id, loot_map_id, quantity) VALUES (?, ?, 1)")
    .bind(userId, lootMapId)
    .run();
}

export async function setLootCollectionQuantity(db: D1Database, userId: string, lootMapId: number, quantity: number): Promise<void> {
  await db
    .prepare("INSERT INTO user_loot_collection (user_id, loot_map_id, quantity) VALUES (?, ?, ?) ON CONFLICT (user_id, loot_map_id) DO UPDATE SET quantity = excluded.quantity")
    .bind(userId, lootMapId, quantity)
    .run();
}

export async function removeFromLootCollection(db: D1Database, userId: string, lootMapId: number): Promise<void> {
  await db
    .prepare("DELETE FROM user_loot_collection WHERE user_id = ? AND loot_map_id = ?")
    .bind(userId, lootMapId)
    .run();
}

export async function getUserLootWishlist(db: D1Database, userId: string): Promise<WishlistItem[]> {
  const result = await db
    .prepare(
      `SELECT lm.id, lm.uuid, lm.name, lm.type, lm.sub_type, lm.rarity,
        lm.category, lm.manufacturer_name,
        ${LOOT_HAS_FLAGS},
        ulw.quantity as wishlist_quantity
      FROM user_loot_wishlist ulw
      JOIN loot_map lm ON lm.id = ulw.loot_map_id
      WHERE ulw.user_id = ?
      ORDER BY lm.name ASC`,
    )
    .bind(userId)
    .all();

  const items = result.results as unknown as (WishlistItem & { id: number })[];
  if (items.length === 0) return items;

  // Batch-fetch locations for all wishlist items
  const ids = items.map(i => i.id);
  const placeholders = ids.map(() => '?').join(',');
  const locResult = await db.prepare(
    `SELECT loot_map_id, source_type, location_key, location_tag, container_type,
      per_container, per_roll, rolls, loot_table,
      buy_price, sell_price,
      actor, faction, slot, probability,
      contract_name, guild, reward_type, amount, weight
    FROM loot_item_locations WHERE loot_map_id IN (${placeholders})`
  ).bind(...ids).all();

  // Group locations by loot_map_id then source_type
  type LocationsByType = { containers: Record<string, unknown>[]; shops: Record<string, unknown>[]; npcs: Record<string, unknown>[]; contracts: Record<string, unknown>[] };
  const locMap = new Map<number, LocationsByType>();
  for (const loc of locResult.results) {
    const r = loc as Record<string, unknown>;
    const mapId = r.loot_map_id as number;
    if (!locMap.has(mapId)) locMap.set(mapId, { containers: [], shops: [], npcs: [], contracts: [] });
    const byType = locMap.get(mapId)!;
    const key = (r.source_type as string) + 's' as keyof LocationsByType;
    if (byType[key]) byType[key].push(r);
  }

  // Attach locations to items
  for (const item of items) {
    item.locations = locMap.get(item.id) ?? { containers: [], shops: [], npcs: [], contracts: [] };
  }

  return items;
}

export async function addToLootWishlist(db: D1Database, userId: string, lootMapId: number): Promise<void> {
  await db
    .prepare("INSERT OR IGNORE INTO user_loot_wishlist (user_id, loot_map_id, quantity) VALUES (?, ?, 1)")
    .bind(userId, lootMapId)
    .run();
}

export async function setLootWishlistQuantity(db: D1Database, userId: string, lootMapId: number, quantity: number): Promise<void> {
  await db
    .prepare("INSERT INTO user_loot_wishlist (user_id, loot_map_id, quantity) VALUES (?, ?, ?) ON CONFLICT (user_id, loot_map_id) DO UPDATE SET quantity = excluded.quantity")
    .bind(userId, lootMapId, quantity)
    .run();
}

export async function removeFromLootWishlist(db: D1Database, userId: string, lootMapId: number): Promise<void> {
  await db
    .prepare("DELETE FROM user_loot_wishlist WHERE user_id = ? AND loot_map_id = ?")
    .bind(userId, lootMapId)
    .run();
}

// ============================================================
// Loot Armor Sets
// ============================================================

export interface LootSetSummary {
  slug: string;
  setName: string;
  manufacturer: string | null;
  pieceCount: number;
}

export interface LootSetDetail {
  setName: string;
  manufacturer: string | null;
  pieces: Record<string, unknown>[];
}

export async function getLootSets(
  db: D1Database,
  patchCode?: string
): Promise<LootSetSummary[]> {
  const lv = latestAsOf(patchCode);
  const sql = `SELECT lm.id, lm.uuid, lm.name, lm.category, lm.manufacturer_name
    FROM loot_map lm
    ${lv.join}
    WHERE ${lv.where}
      AND lm.category IN ('armour', 'helmet', 'undersuit')
      AND lm.name NOT IN ('<= PLACEHOLDER =>')
      AND lm.type IS NOT NULL AND lm.type != ''
    ORDER BY lm.name ASC`;
  const result = await db.prepare(sql).bind(...lv.params).all();

  const groups = new Map<
    string,
    { setName: string; manufacturer: string | null; count: number }
  >();
  for (const row of result.results) {
    const r = row as { name: string; manufacturer_name: string | null };
    const sn = extractSetName(r.name, r.manufacturer_name);
    if (!sn) continue;
    const slug = makeSetSlug(sn);
    const existing = groups.get(slug);
    if (existing) {
      existing.count++;
      if (!existing.manufacturer && r.manufacturer_name)
        existing.manufacturer = r.manufacturer_name;
    } else {
      groups.set(slug, {
        setName: sn,
        manufacturer: r.manufacturer_name,
        count: 1,
      });
    }
  }

  return [...groups.entries()]
    .map(([slug, g]) => ({
      slug,
      setName: g.setName,
      manufacturer: g.manufacturer,
      pieceCount: g.count,
    }))
    .sort((a, b) => a.setName.localeCompare(b.setName));
}

export async function getLootSetBySlug(
  db: D1Database,
  setSlug: string,
  patchCode?: string
): Promise<LootSetDetail | null> {
  const lv = latestAsOf(patchCode);
  const sql = `SELECT lm.*,
      ${LOOT_HAS_FLAGS}
    FROM loot_map lm
    ${lv.join}
    WHERE ${lv.where}
      AND lm.category IN ('armour', 'helmet', 'undersuit')
      AND lm.name NOT IN ('<= PLACEHOLDER =>')
      AND lm.type IS NOT NULL AND lm.type != ''
    ORDER BY lm.name ASC`;
  const result = await db.prepare(sql).bind(...lv.params).all();

  // Filter to matching set pieces
  const matchingItems: Record<string, unknown>[] = [];
  let setName: string | null = null;
  let manufacturer: string | null = null;
  const armourIds: number[] = [];
  const helmetIds: number[] = [];

  for (const row of result.results) {
    const item = row as Record<string, unknown>;
    const sn = extractSetName(
      item.name as string,
      item.manufacturer_name as string | null
    );
    if (!sn) continue;
    if (makeSetSlug(sn) !== setSlug) continue;

    if (!setName) setName = sn;
    if (!manufacturer && item.manufacturer_name)
      manufacturer = item.manufacturer_name as string;

    matchingItems.push(item);
    if (item.fps_armour_id) armourIds.push(item.fps_armour_id as number);
    if (item.fps_helmet_id) helmetIds.push(item.fps_helmet_id as number);
  }

  if (!setName || matchingItems.length === 0) return null;

  // Batch-fetch linked item details (2 queries instead of N)
  const detailMap = new Map<string, Record<string, unknown>>();

  if (armourIds.length > 0) {
    const placeholders = armourIds.map(() => "?").join(",");
    const rows = await db
      .prepare(
        `SELECT id, name, sub_type as type, size, grade, description, resist_physical, resist_energy, resist_distortion, resist_thermal, resist_biochemical, resist_stun, ir_emission, em_emission, item_port_count FROM fps_armour WHERE id IN (${placeholders})`
      )
      .bind(...armourIds)
      .all();
    for (const r of rows.results) {
      detailMap.set(`armour:${(r as Record<string, unknown>).id}`, r as Record<string, unknown>);
    }
  }

  if (helmetIds.length > 0) {
    const placeholders = helmetIds.map(() => "?").join(",");
    const rows = await db
      .prepare(
        `SELECT id, name, sub_type as type, size, grade, description, resist_physical, resist_energy, resist_distortion, resist_thermal, resist_biochemical, resist_stun, ir_emission, em_emission, item_port_count, atmosphere_capacity FROM fps_helmets WHERE id IN (${placeholders})`
      )
      .bind(...helmetIds)
      .all();
    for (const r of rows.results) {
      detailMap.set(`helmet:${(r as Record<string, unknown>).id}`, r as Record<string, unknown>);
    }
  }

  // Batch-fetch locations for all set pieces
  const pieceIds = matchingItems.map(i => i.id as number);
  const locMap = new Map<number, Record<string, Record<string, unknown>[]>>();
  if (pieceIds.length > 0) {
    const locPlaceholders = pieceIds.map(() => '?').join(',');
    const locResult = await db.prepare(
      `SELECT loot_map_id, source_type, location_key, location_tag, container_type,
        per_container, buy_price, sell_price, actor, faction, slot, probability,
        contract_name, guild
      FROM loot_item_locations WHERE loot_map_id IN (${locPlaceholders})`
    ).bind(...pieceIds).all();

    for (const loc of locResult.results) {
      const r = loc as Record<string, unknown>;
      const mapId = r.loot_map_id as number;
      if (!locMap.has(mapId)) locMap.set(mapId, { containers: [], shops: [], npcs: [], contracts: [] });
      const byType = locMap.get(mapId)!;
      const key = (r.source_type as string) + 's';
      if (byType[key]) byType[key].push(r);
    }
  }

  const pieces = matchingItems.map((item) => {
    let details: Record<string, unknown> | null = null;
    if (item.fps_armour_id)
      details = detailMap.get(`armour:${item.fps_armour_id}`) ?? null;
    else if (item.fps_helmet_id)
      details = detailMap.get(`helmet:${item.fps_helmet_id}`) ?? null;
    const locations = locMap.get(item.id as number) ?? { containers: [], shops: [], npcs: [], contracts: [] };
    return { ...item, item_details: details, locations };
  });

  return { setName, manufacturer, pieces };
}

// ============================================================
// App Settings Operations
// ============================================================

export async function getAppSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function setAppSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(key, value)
    .run();
}

// ============================================================
// Pre-load Functions (bulk-load lookup tables into Maps)
// ============================================================

export interface VehicleRow {
  id: number;
  slug: string;
  name: string;
}

export async function loadVehicleMaps(
  db: D1Database,
): Promise<{
  bySlug: Map<string, number>;
  byNameLower: Map<string, number>;
  allRows: VehicleRow[];
}> {
  const result = await db.prepare("SELECT id, slug, name FROM vehicles WHERE is_paint_variant = 0").all();
  const bySlug = new Map<string, number>();
  const byNameLower = new Map<string, number>();
  const allRows: VehicleRow[] = [];
  for (const row of result.results) {
    const r = row as unknown as VehicleRow;
    bySlug.set(r.slug, r.id);
    byNameLower.set(r.name.toLowerCase(), r.id);
    allRows.push(r);
  }
  return { bySlug, byNameLower, allRows };
}

// ============================================================
// Statement Builders (return D1PreparedStatement for batching)
// ============================================================

export function buildUpdateVehicleImagesStatement(
  db: D1Database,
  slug: string,
  imageURL: string,
  small: string,
  medium: string,
  large: string,
): D1PreparedStatement[] {
  // Only update vehicles.image_url* if this vehicle has no CF Images ID yet.
  // CF delivery URLs are authoritative — RSI sync must not overwrite them.
  return [
    db
      .prepare(
        `UPDATE vehicles SET
          image_url = ?, image_url_small = ?, image_url_medium = ?, image_url_large = ?,
          updated_at = datetime('now')
        WHERE slug = ?
          AND NOT EXISTS (
            SELECT 1 FROM vehicle_images
            WHERE vehicle_id = vehicles.id AND cf_images_id IS NOT NULL
          )`,
      )
      .bind(imageURL, small, medium, large, slug),
  ];
}

// ============================================================
// Batched Write Functions
// ============================================================

export async function setPaintVehiclesBatch(
  db: D1Database,
  paintID: number,
  vehicleIDs: number[],
): Promise<void> {
  const stmts: D1PreparedStatement[] = [
    db.prepare("DELETE FROM paint_vehicles WHERE paint_id = ?").bind(paintID),
  ];
  for (const vid of vehicleIDs) {
    stmts.push(
      db
        .prepare("INSERT OR IGNORE INTO paint_vehicles (paint_id, vehicle_id) VALUES (?, ?)")
        .bind(paintID, vid),
    );
  }
  await db.batch(stmts);
}

export async function syncVehicleLoanersBatch(
  db: D1Database,
  vehicleID: number,
  loanerSlugs: string[],
): Promise<void> {
  const stmts: D1PreparedStatement[] = [
    db.prepare("DELETE FROM vehicle_loaners WHERE vehicle_id = ?").bind(vehicleID),
  ];
  for (const slug of loanerSlugs) {
    stmts.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO vehicle_loaners (vehicle_id, loaner_id) SELECT ?, id FROM vehicles WHERE slug = ?",
        )
        .bind(vehicleID, slug),
    );
  }
  await db.batch(stmts);
}

// ============================================================
// Cloudflare Images
// ============================================================

export interface VehicleForCFUpload {
  vehicle_id: number;
  slug: string;
  best_image_url: string;
}

export async function getVehiclesNeedingCFUpload(
  db: D1Database,
  limit: number,
  offset: number,
): Promise<VehicleForCFUpload[]> {
  const result = await db
    .prepare(
      `SELECT v.id as vehicle_id, v.slug, v.image_url as best_image_url
      FROM vehicles v
      JOIN vehicle_images vi ON vi.vehicle_id = v.id
      WHERE vi.cf_images_id IS NULL
        AND v.image_url IS NOT NULL
        AND v.image_url LIKE 'http%'
      ORDER BY v.slug
      LIMIT ? OFFSET ?`,
    )
    .bind(limit, offset)
    .all<VehicleForCFUpload>();
  return result.results;
}

// --- Loot by-location aggregation (POI feature) ---

interface LocationAggRow {
  key: string;
  itemCount: number;
  r_Common: number;
  r_Uncommon: number;
  r_Rare: number;
  r_Epic: number;
  r_Legendary: number;
}

interface LocationSummary {
  key: string;
  itemCount: number;
  rarities: Record<string, number>;
}

interface LootLocationSummaryResult {
  containers: LocationSummary[];
  shops: LocationSummary[];
  npcs: LocationSummary[];
}

/** Shared loot exclusion filters (non-version, applied in WHERE). */
const LOOT_EXCLUSION_FILTER = `lm.removed = 0
  AND lm.name NOT IN ('<= PLACEHOLDER =>')
  AND lm.name NOT LIKE 'EntityClassDefinition.%'
  AND lm.type IS NOT NULL AND lm.type != ''
  AND lm.type NOT IN (
    'NOITEM_Vehicle','UNDEFINED',
    'Char_Skin_Color','Char_Head_Hair','Char_Hair_Color',
    'Char_Head_Eyes','Char_Body','Char_Head_Eyelash',
    'Currency','MobiGlas'
  )`;


/**
 * Lightweight summary for the POI directory page.
 * Returns location keys + item counts + rarity distributions.
 * Uses indexed loot_item_locations junction table — no JSON parsing.
 */
export async function getLootLocationSummary(db: D1Database, patchCode?: string): Promise<LootLocationSummaryResult> {
  // Optimized: filter directly on junction table's game_version_id instead of
  // expensive MAX(game_version_id) correlated subquery. The junction table already
  // stores version_id per row, so we can skip the UUID-dedup pattern.
  const versionCap = patchCode
    ? `(SELECT id FROM game_versions WHERE code = ?)`
    : `(SELECT id FROM game_versions WHERE is_default = 1)`;
  const params = patchCode ? [patchCode] : [];

  const sql = `SELECT lil.source_type, lil.location_key as key,
      COUNT(DISTINCT lil.loot_map_id) as itemCount,
      SUM(CASE WHEN COALESCE(lm.rarity, 'Common') = 'Common' THEN 1 ELSE 0 END) as r_Common,
      SUM(CASE WHEN lm.rarity = 'Uncommon' THEN 1 ELSE 0 END) as r_Uncommon,
      SUM(CASE WHEN lm.rarity = 'Rare' THEN 1 ELSE 0 END) as r_Rare,
      SUM(CASE WHEN lm.rarity = 'Epic' THEN 1 ELSE 0 END) as r_Epic,
      SUM(CASE WHEN lm.rarity = 'Legendary' THEN 1 ELSE 0 END) as r_Legendary
    FROM loot_item_locations lil
    JOIN loot_map lm ON lm.id = lil.loot_map_id
    WHERE lil.game_version_id = ${versionCap}
      AND lil.location_key != ''
      AND ${LOOT_EXCLUSION_FILTER}
    GROUP BY lil.source_type, lil.location_key`;

  const result = await db.prepare(sql).bind(...params).all<LocationAggRow & { source_type: string }>();

  function toSummaries(rows: (LocationAggRow & { source_type: string })[]): LocationSummary[] {
    return rows.map((r) => {
      const rarities: Record<string, number> = {};
      if (r.r_Common) rarities.Common = r.r_Common;
      if (r.r_Uncommon) rarities.Uncommon = r.r_Uncommon;
      if (r.r_Rare) rarities.Rare = r.r_Rare;
      if (r.r_Epic) rarities.Epic = r.r_Epic;
      if (r.r_Legendary) rarities.Legendary = r.r_Legendary;
      return { key: r.key, itemCount: r.itemCount, rarities };
    });
  }

  const grouped = { containers: [] as (LocationAggRow & { source_type: string })[], shops: [] as (LocationAggRow & { source_type: string })[], npcs: [] as (LocationAggRow & { source_type: string })[] };
  for (const row of result.results) {
    if (row.source_type === 'container') grouped.containers.push(row);
    else if (row.source_type === 'shop') grouped.shops.push(row);
    else if (row.source_type === 'npc') grouped.npcs.push(row);
  }

  return {
    containers: toSummaries(grouped.containers),
    shops: toSummaries(grouped.shops),
    npcs: toSummaries(grouped.npcs),
  };
}

/**
 * Full item list for a single location (POI detail page).
 * Direct indexed lookup on loot_item_locations junction table.
 */
interface LocationItem {
  uuid: string;
  name: string;
  type: string | null;
  sub_type: string | null;
  rarity: string | null;
  category: string;
  perContainer?: number;
  containerType?: string;
  buyPrice?: number;
  probability?: number;
  slot?: string;
}

interface LocationDetailResult {
  items: LocationItem[];
}

export async function getLootLocationDetail(
  db: D1Database,
  locType: "container" | "shop" | "npc",
  slug: string,
  patchCode?: string,
): Promise<LocationDetailResult> {
  const sourceType = locType; // 'container', 'shop', 'npc' — matches junction table values

  // Source-specific columns from junction table
  const extraCols =
    locType === "container"
      ? ", lil.per_container, lil.container_type"
    : locType === "shop"
      ? ", lil.buy_price"
    : ", lil.probability, lil.slot";

  // Optimized: filter on junction table's game_version_id directly
  const versionCap = patchCode
    ? `(SELECT id FROM game_versions WHERE code = ?)`
    : `(SELECT id FROM game_versions WHERE is_default = 1)`;
  const versionParams = patchCode ? [patchCode] : [];

  const sql = `SELECT DISTINCT
      lm.uuid, lm.name, lm.type, lm.sub_type, lm.rarity, lm.category
      ${extraCols}
    FROM loot_item_locations lil
    JOIN loot_map lm ON lm.id = lil.loot_map_id
    WHERE lil.game_version_id = ${versionCap}
      AND lil.source_type = ?
      AND lil.location_key = ?
      AND ${LOOT_EXCLUSION_FILTER}
    ORDER BY lm.name`;

  const result = await db.prepare(sql).bind(...versionParams, sourceType, slug).all<{
    uuid: string;
    name: string;
    type: string | null;
    sub_type: string | null;
    rarity: string | null;
    category: string;
    per_container?: number | null;
    container_type?: string | null;
    buy_price?: number | null;
    probability?: number | null;
    slot?: string | null;
  }>();

  const items: LocationItem[] = [];
  const seen = new Set<string>();

  for (const row of result.results) {
    if (seen.has(row.uuid)) continue;
    seen.add(row.uuid);
    const item: LocationItem = {
      uuid: row.uuid,
      name: row.name,
      type: row.type,
      sub_type: row.sub_type,
      rarity: row.rarity,
      category: row.category,
    };
    if (locType === "container") {
      if (row.per_container != null) item.perContainer = row.per_container;
      if (row.container_type != null) item.containerType = row.container_type;
    } else if (locType === "shop") {
      if (row.buy_price != null) item.buyPrice = row.buy_price;
    } else {
      if (row.probability != null) item.probability = row.probability;
      if (row.slot != null) item.slot = row.slot;
    }
    items.push(item);
  }

  return { items };
}

export async function setVehicleCFImagesID(
  db: D1Database,
  vehicleId: number,
  cfImagesId: string,
  accountHash: string,
): Promise<void> {
  const base = `https://imagedelivery.net/${accountHash}/${cfImagesId}`;
  await db.batch([
    db
      .prepare(
        `UPDATE vehicle_images SET cf_images_id = ?, updated_at = datetime('now')
        WHERE vehicle_id = ?`,
      )
      .bind(cfImagesId, vehicleId),
    db
      .prepare(
        `UPDATE vehicles SET
          image_url        = ?,
          image_url_small  = ?,
          image_url_medium = ?,
          image_url_large  = ?,
          updated_at       = datetime('now')
        WHERE id = ?`,
      )
      .bind(
        `${base}/medium`,
        `${base}/thumb`,
        `${base}/medium`,
        `${base}/large`,
        vehicleId,
      ),
  ]);
}

// ── Salvageable Ships ─────────────────────────────────────────────────

/**
 * Get salvage variants for a specific ship by slug.
 * Returns the derelict/boarded variants and what components the base ship has.
 */
export async function getSalvageForShip(
  db: D1Database,
  slug: string,
): Promise<Record<string, unknown> | null> {
  const { results: variants } = await db
    .prepare(
      `SELECT ss.id, ss.entity_name, ss.variant_type
       FROM salvageable_ships ss
       JOIN vehicles v ON v.id = ss.base_vehicle_id
       WHERE v.slug = ? AND v.${VEHICLE_VERSION_CAP}
       ORDER BY ss.variant_type`,
    )
    .bind(slug)
    .all();

  if (!variants || variants.length === 0) return null;

  return { variants };
}

/**
 * List all salvageable ships grouped by base vehicle.
 */
export async function listSalvageableShips(
  db: D1Database,
): Promise<Record<string, unknown>[]> {
  const { results } = await db
    .prepare(
      `SELECT
         v.slug, v.name, v.class_name,
         v.image_url_small,
         m.name as manufacturer_name, m.code as manufacturer_code,
         COUNT(ss.id) as variant_count,
         GROUP_CONCAT(DISTINCT ss.variant_type) as variant_types
       FROM salvageable_ships ss
       JOIN vehicles v ON v.id = ss.base_vehicle_id AND v.${VEHICLE_VERSION_CAP}
       LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
       WHERE ss.base_vehicle_id IS NOT NULL
       GROUP BY v.id
       ORDER BY v.name`,
    )
    .all();

  return results;
}
