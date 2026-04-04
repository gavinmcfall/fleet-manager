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

// --- Loot summary stats (category-aware card display) ---
// LEFT JOINs to detail tables for key stats shown on item cards.
// Each loot_map row has at most ONE FK set, so only one JOIN produces data per row.
const LOOT_SUMMARY_JOINS = `
        LEFT JOIN fps_weapons _fw ON _fw.id = lm.fps_weapon_id
        LEFT JOIN fps_melee _fm ON _fm.id = lm.fps_melee_id
        LEFT JOIN fps_armour _fa ON _fa.id = lm.fps_armour_id
        LEFT JOIN fps_helmets _fh ON _fh.id = lm.fps_helmet_id
        LEFT JOIN fps_clothing _fcl ON _fcl.id = lm.fps_clothing_id
        LEFT JOIN fps_attachments _fat ON _fat.id = lm.fps_attachment_id
        LEFT JOIN fps_utilities _fu ON _fu.id = lm.fps_utility_id
        LEFT JOIN fps_carryables _fca ON _fca.id = lm.fps_carryable_id
        LEFT JOIN vehicle_components _vc ON _vc.id = lm.vehicle_component_id
        LEFT JOIN component_weapons _vcw ON _vcw.component_id = _vc.id
        LEFT JOIN component_powerplants _vcp ON _vcp.component_id = _vc.id
        LEFT JOIN component_coolers _vcc ON _vcc.component_id = _vc.id
        LEFT JOIN component_shields _vcs ON _vcs.component_id = _vc.id
        LEFT JOIN component_quantum_drives _vcq ON _vcq.component_id = _vc.id
        LEFT JOIN ship_missiles _sm ON _sm.id = lm.ship_missile_id`;

const LOOT_SUMMARY_COLS = `
        COALESCE(_fw.dps, _vcw.dps) as dps,
        COALESCE(_fw.damage_type, _fm.damage_type, _vcw.damage_type) as damage_type,
        COALESCE(_fa.resist_physical, _fh.resist_physical, _fcl.resist_physical) as resist_physical,
        COALESCE(_fa.resist_energy, _fh.resist_energy, _fcl.resist_energy) as resist_energy,
        COALESCE(_fa.resist_distortion, _fh.resist_distortion, _fcl.resist_distortion) as resist_distortion,
        _fh.atmosphere_capacity,
        _vc.size as comp_size, _vc.grade as comp_grade,
        _vcp.power_output, _vcc.cooling_rate, _vcs.shield_hp, _vcs.shield_regen,
        _vcq.quantum_speed, _vcq.quantum_range,
        _sm.tracking_signal, _sm.damage as missile_damage, _sm.lock_time, _sm.speed as missile_speed,
        _fcl.storage_capacity, _fcl.temperature_range_min, _fcl.temperature_range_max,
        _fat.zoom_scale, _fat.damage_multiplier, _fat.sound_radius_multiplier,
        _fu.heal_amount, _fu.blast_radius as utility_blast_radius, _fu.device_type,
        _fw.rounds_per_minute, _fw.effective_range, _fw.ammo_capacity,
        _fw.fire_modes as weapon_fire_modes,
        _fw.weapon_class,
        COALESCE(_fa.sub_type, _fh.sub_type) as armour_weight,
        _vc.sub_type as comp_sub_type,
        _vc.component_class,
        _fm.damage as melee_damage, _fm.heavy_damage as melee_heavy_damage,
        _fca.mass as carryable_mass, _fca.interaction_type as carryable_interaction`;

// --- Loot JSON "has_*" column expressions ---
// Reusable SQL fragment for SELECT clauses that compute boolean flags from JSON blob columns.
// Each flag is 1 if the JSON column contains actual data, 0 otherwise.
const LOOT_HAS_FLAGS = `
        EXISTS(SELECT 1 FROM loot_item_locations lil WHERE lil.loot_map_id = lm.id AND lil.source_type = 'container') as has_containers,
        EXISTS(SELECT 1 FROM shop_inventory si WHERE si.item_uuid = lm.uuid AND (si.buy_price > 0 OR si.sell_price > 0)) as has_shops,
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
      LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
      LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
      WHERE v.slug = ?`,
    )
    .bind(slug)
    .first();
  return row as unknown as Vehicle | null;
}

export async function getVehicleCount(db: D1Database): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) as count FROM vehicles v`).first<{ count: number }>();
  return row?.count ?? 0;
}

export async function getVehicleIDBySlug(db: D1Database, slug: string): Promise<number | null> {
  const row = await db
    .prepare(`SELECT v.id FROM vehicles v WHERE v.slug = ? LIMIT 1`)
    .bind(slug)
    .first<{ id: number }>();
  return row?.id ?? null;
}

export async function getAllVehicleNameSlugs(
  db: D1Database,
): Promise<Array<{ name: string; slug: string }>> {
  const result = await db.prepare(`SELECT v.name, v.slug FROM vehicles v ORDER BY v.name`).all();
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
    .prepare(`SELECT v.id FROM vehicles v WHERE v.slug LIKE ?`)
    .bind(pattern)
    .all();
  return result.results.map((r) => (r as { id: number }).id);
}

export async function findVehicleIDsBySlugPrefix(
  db: D1Database,
  prefix: string,
): Promise<number[]> {
  const result = await db
    .prepare(`SELECT v.id FROM vehicles v WHERE v.slug LIKE ?`)
    .bind(prefix + "%")
    .all();
  return result.results.map((r) => (r as { id: number }).id);
}

export async function findVehicleIDsByNameContains(
  db: D1Database,
  term: string,
): Promise<number[]> {
  const result = await db
    .prepare(`SELECT v.id FROM vehicles v WHERE LOWER(v.name) LIKE ?`)
    .bind("%" + term.toLowerCase() + "%")
    .all();
  return result.results.map((r) => (r as { id: number }).id);
}

// ============================================================
// Port Operations
// ============================================================

export async function getShipLoadout(db: D1Database, slug: string): Promise<Record<string, unknown>[]> {
  // Resolve the full weapon hierarchy for each top-level port.
  // Ships can have 1-3 levels: Port → [Gimbal →] [Turret →] WeaponGun.
  // We walk down the tree to find the deepest actual weapon, and return it
  // alongside the mount name (intermediate item) for the parent-child UI.
  //
  // Architecture:
  // 1. ship_ports: all ports for this ship
  // 2. deepest_weapon: recursive walk from each top-level port to find the
  //    deepest WeaponGun (or any real component) at the leaf
  // 3. Main SELECT: top-level ports with mount + weapon resolved

  // Use a recursive CTE to find the deepest "real" component (WeaponGun, Shield, etc.)
  // for each top-level port, walking through any number of intermediate levels
  // (TurretBase → Gimbal → WeaponGun, or just Gimbal → WeaponGun, etc.)
  const result = await db
    .prepare(
      `WITH ship_ports AS (
        SELECT vp.* FROM vehicle_ports vp
        WHERE vp.vehicle_id IN (SELECT v.id FROM vehicles v WHERE v.slug = ?)
      ),
      -- Walk from each returned port down to its deepest child with a real component.
      -- Starts from top-level ports AND turret children (which are also returned in results).
      port_tree AS (
        SELECT
          p.id AS root_id,
          p.id AS current_id,
          p.equipped_item_uuid,
          0 AS depth
        FROM ship_ports p
        WHERE p.category_label IS NOT NULL
          AND (
            p.parent_port_id IS NULL
            OR EXISTS (SELECT 1 FROM ship_ports tp WHERE tp.id = p.parent_port_id AND tp.port_type = 'turret' AND tp.parent_port_id IS NULL)
          )
        UNION ALL
        SELECT
          pt.root_id,
          c.id,
          c.equipped_item_uuid,
          pt.depth + 1
        FROM port_tree pt
        JOIN ship_ports c ON c.parent_port_id = pt.current_id
        WHERE pt.depth < 4
      ),
      -- For each root port, find the deepest child that has a WeaponGun component
      deepest AS (
        SELECT
          pt.root_id,
          vc.name, vc.type, vc.sub_type, vc.size, vc.grade, vc.class,
          cw.dps, cw.damage_per_shot, cw.damage_type, cw.rounds_per_minute,
          cw.projectile_speed, cw.effective_range, cw.heat_per_shot,
          cw.ammo_container_size, vc.power_draw, vc.power_draw_min, cw.fire_modes,
          cs.shield_hp, cs.shield_regen, cs.resist_physical, cs.resist_energy,
          cs.resist_distortion, cs.resist_thermal, cs.regen_delay, cs.downed_regen_delay,
          cp.power_output, cp.overpower_performance, cp.overclock_performance,
          vc.thermal_output, cc.cooling_rate, cc.max_temperature, cc.overheat_temperature,
          cq.quantum_speed, cq.quantum_range, cq.fuel_rate, cq.spool_time,
          cr.radar_range, cr.radar_angle, ct.rotation_speed,
          cw.damage_physical, cw.damage_energy, cw.damage_distortion, cw.damage_thermal,
          cw.penetration, cw.weapon_range,
          cs.resist_physical_min, cs.resist_energy_min, cs.resist_distortion_min, cs.resist_thermal_min,
          cs.absorb_physical_min, cs.absorb_physical_max,
          m.name AS manufacturer_name,
          pt.depth,
          ROW_NUMBER() OVER (PARTITION BY pt.root_id ORDER BY
            CASE WHEN vc.type IN ('WeaponGun', 'Missile') THEN 0
                 WHEN vc.type IN ('MissileLauncher','WeaponDefensive') THEN 1
                 WHEN vc.type IN ('Shield','PowerPlant','Cooler','QuantumDrive','Radar') THEN 0
                 WHEN vc.type = 'Turret' THEN 2
                 ELSE 3 END,
            pt.depth DESC
          ) AS rn
        FROM port_tree pt
        JOIN vehicle_components vc ON vc.uuid = pt.equipped_item_uuid
        LEFT JOIN manufacturers m ON m.id = vc.manufacturer_id
        LEFT JOIN component_powerplants cp ON cp.component_id = vc.id
        LEFT JOIN component_coolers cc ON cc.component_id = vc.id
        LEFT JOIN component_shields cs ON cs.component_id = vc.id
        LEFT JOIN component_quantum_drives cq ON cq.component_id = vc.id
        LEFT JOIN component_weapons cw ON cw.component_id = vc.id
        LEFT JOIN component_turrets ct ON ct.component_id = vc.id
        LEFT JOIN component_radar cr ON cr.component_id = vc.id
        WHERE vc.type NOT IN ('Display', 'SeatDashboard', 'Seat', 'SeatAccess')
      ),
      -- Count real weapons under each root (for turrets: how many guns)
      weapon_count AS (
        SELECT pt.root_id, COUNT(*) AS cnt
        FROM port_tree pt
        JOIN vehicle_components vc ON vc.uuid = pt.equipped_item_uuid
        WHERE vc.type IN ('WeaponGun', 'Missile') AND pt.depth > 0
        GROUP BY pt.root_id
      ),
      -- Count missile slots under missile racks
      missile_count AS (
        SELECT sp.parent_port_id AS rack_id, COUNT(*) AS cnt
        FROM ship_ports sp
        WHERE sp.port_name LIKE 'missile_%_attach'
          AND sp.parent_port_id IS NOT NULL
        GROUP BY sp.parent_port_id
      )
      SELECT
        p.id AS port_id,
        p.parent_port_id,
        p.port_name AS port_name,
        p.category_label,
        p.port_type,
        p.min_size AS size_min,
        p.max_size AS size_max,
        p.editable,
        mount.name AS mount_name,
        mount.type AS mount_type,
        COALESCE(d.name, mount.name) AS child_name,
        COALESCE(d.name, mount.name) AS component_name,
        COALESCE(d.type, mount.type) AS component_type,
        COALESCE(d.sub_type, mount.sub_type) AS sub_type,
        COALESCE(d.size, mount.size) AS component_size,
        COALESCE(d.grade, mount.grade) AS grade,
        COALESCE(d.dps, mw.dps) AS dps,
        COALESCE(d.damage_per_shot, mw.damage_per_shot) AS damage_per_shot,
        COALESCE(d.damage_type, mw.damage_type) AS damage_type,
        COALESCE(d.rounds_per_minute, mw.rounds_per_minute) AS rounds_per_minute,
        COALESCE(d.projectile_speed, mw.projectile_speed) AS projectile_speed,
        COALESCE(d.effective_range, mw.effective_range) AS effective_range,
        COALESCE(d.ammo_container_size, mw.ammo_container_size) AS ammo_container_size,
        COALESCE(d.shield_hp, ms.shield_hp) AS shield_hp,
        COALESCE(d.shield_regen, ms.shield_regen) AS shield_regen,
        COALESCE(d.resist_physical, ms.resist_physical) AS resist_physical,
        COALESCE(d.resist_energy, ms.resist_energy) AS resist_energy,
        COALESCE(d.resist_distortion, ms.resist_distortion) AS resist_distortion,
        COALESCE(d.resist_thermal, ms.resist_thermal) AS resist_thermal,
        COALESCE(d.regen_delay, ms.regen_delay) AS regen_delay,
        COALESCE(d.downed_regen_delay, ms.downed_regen_delay) AS downed_regen_delay,
        COALESCE(d.power_output, mp.power_output) AS power_output,
        COALESCE(d.overpower_performance, mp.overpower_performance) AS overpower_performance,
        COALESCE(d.overclock_performance, mp.overclock_performance) AS overclock_performance,
        COALESCE(d.thermal_output, mount.thermal_output) AS thermal_output,
        COALESCE(d.cooling_rate, mc2.cooling_rate) AS cooling_rate,
        COALESCE(d.quantum_speed, mq.quantum_speed) AS quantum_speed,
        COALESCE(d.quantum_range, mq.quantum_range) AS quantum_range,
        COALESCE(d.fuel_rate, mq.fuel_rate) AS fuel_rate,
        COALESCE(d.spool_time, mq.spool_time) AS spool_time,
        COALESCE(d.radar_range, mr.radar_range) AS radar_range,
        COALESCE(d.radar_angle, mr.radar_angle) AS radar_angle,
        COALESCE(d.power_draw, mount.power_draw) AS power_draw,
        COALESCE(d.power_draw_min, mount.power_draw_min) AS power_draw_min,
        COALESCE(d.rotation_speed, mt.rotation_speed) AS rotation_speed,
        COALESCE(d.damage_physical, mw.damage_physical, 0) AS damage_physical,
        COALESCE(d.damage_energy, mw.damage_energy, 0) AS damage_energy,
        COALESCE(d.damage_distortion, mw.damage_distortion, 0) AS damage_distortion,
        COALESCE(d.damage_thermal, mw.damage_thermal, 0) AS damage_thermal,
        COALESCE(d.penetration, mw.penetration, 0) AS penetration,
        COALESCE(d.weapon_range, mw.weapon_range, 0) AS weapon_range,
        COALESCE(d.resist_physical_min, ms.resist_physical_min) AS resist_physical_min,
        COALESCE(d.resist_energy_min, ms.resist_energy_min) AS resist_energy_min,
        COALESCE(d.resist_distortion_min, ms.resist_distortion_min) AS resist_distortion_min,
        COALESCE(d.resist_thermal_min, ms.resist_thermal_min) AS resist_thermal_min,
        COALESCE(d.absorb_physical_min, ms.absorb_physical_min) AS absorb_physical_min,
        COALESCE(d.absorb_physical_max, ms.absorb_physical_max) AS absorb_physical_max,
        COALESCE(d.manufacturer_name, mm.name) AS manufacturer_name,
        COALESCE(wc.cnt, 0) AS weapon_count,
        COALESCE(mc.cnt, 0) AS missile_count
      FROM ship_ports p
      LEFT JOIN vehicle_components mount ON mount.uuid = p.equipped_item_uuid
      LEFT JOIN manufacturers mm ON mm.id = mount.manufacturer_id
      LEFT JOIN component_powerplants mp ON mp.component_id = mount.id
      LEFT JOIN component_coolers mc2 ON mc2.component_id = mount.id
      LEFT JOIN component_shields ms ON ms.component_id = mount.id
      LEFT JOIN component_quantum_drives mq ON mq.component_id = mount.id
      LEFT JOIN component_weapons mw ON mw.component_id = mount.id
      LEFT JOIN component_turrets mt ON mt.component_id = mount.id
      LEFT JOIN component_radar mr ON mr.component_id = mount.id
      LEFT JOIN deepest d ON d.root_id = p.id AND d.rn = 1
      LEFT JOIN weapon_count wc ON wc.root_id = p.id
      LEFT JOIN missile_count mc ON mc.rack_id = p.id
      WHERE p.category_label IS NOT NULL
        AND p.port_type IN ('weapon', 'turret', 'missile', 'shield', 'power', 'cooler',
            'quantum_drive', 'jump_drive', 'countermeasure', 'sensor', 'module',
            'personal_storage', 'cargo_grid')
        -- Return top-level ports OR weapon-mount children of turrets OR jump drive children of QD
        AND (
          p.parent_port_id IS NULL
          OR EXISTS (
            SELECT 1 FROM ship_ports tp
            WHERE tp.id = p.parent_port_id AND tp.port_type = 'turret'
              AND tp.parent_port_id IS NULL
          )
          OR (p.port_type = 'jump_drive' AND EXISTS (
            SELECT 1 FROM ship_ports qp
            WHERE qp.id = p.parent_port_id AND qp.port_type = 'quantum_drive'
          ))
        )
        -- Exclude noise components (Display, etc.) and empty child ports
        AND (
          d.root_id IS NOT NULL
          OR (mount.type IS NOT NULL AND mount.type NOT IN ('Display', 'SeatDashboard', 'Seat', 'SeatAccess'))
          OR (p.equipped_item_uuid IS NULL AND p.parent_port_id IS NULL)
          OR (p.equipped_item_uuid IS NOT NULL AND mount.uuid IS NULL)
        )
        -- Exclude individual missile slots (keep the rack)
        AND p.port_name NOT LIKE 'missile_%_attach'
        -- Exclude individual torpedo storage slots (keep the rack)
        AND p.port_name NOT LIKE 'hardpoint_torpedo_storage_%'
        -- Exclude access/hatch mechanism ports
        AND p.port_name NOT LIKE '%_access'
      ORDER BY
        CASE p.category_label
          WHEN 'Weapons' THEN 1 WHEN 'Turrets' THEN 2 WHEN 'Missiles' THEN 3
          WHEN 'Shields' THEN 4 WHEN 'Power' THEN 5 WHEN 'Cooling' THEN 6
          WHEN 'Quantum Drive' THEN 7 WHEN 'Jump Drive' THEN 8
          WHEN 'Countermeasures' THEN 9 WHEN 'Sensors' THEN 10
          WHEN 'Modules' THEN 11 ELSE 20 END,
        p.max_size DESC, p.port_name`,
    )
    .bind(slug)
    .all();

  return result.results as Record<string, unknown>[];
}

export async function getShipModules(db: D1Database, slug: string): Promise<Record<string, unknown>[]> {
  const result = await db
    .prepare(
      `SELECT vm.id, vm.uuid, vm.port_name, vm.class_name, vm.display_name,
              vm.size, vm.is_default, vm.has_loadout
       FROM vehicle_modules vm
       WHERE vm.vehicle_id IN (SELECT v.id FROM vehicles v WHERE v.slug = ?)
       ORDER BY vm.port_name, vm.is_default DESC, vm.display_name`
    )
    .bind(slug)
    .all();
  return result.results as Record<string, unknown>[];
}

export async function getUserOwnedModuleTitles(db: D1Database, userId: string): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT DISTINCT title FROM user_pledge_items
       WHERE user_id = ? AND kind = 'Component' AND LOWER(title) LIKE '%module%'`
    )
    .bind(userId)
    .all<{ title: string }>();
  return result.results.map((r) => r.title);
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
        COALESCE(rv.name, v.name) as vehicle_name,
        COALESCE(rv.slug, v.slug) as vehicle_slug,
        COALESCE(rv.image_url, v.image_url) as image_url,
        COALESCE(rv.focus, v.focus) as focus,
        COALESCE(rv.size_label, v.size_label) as size_label,
        COALESCE(rv.cargo, v.cargo) as cargo,
        COALESCE(rv.crew_min, v.crew_min) as crew_min,
        COALESCE(rv.crew_max, v.crew_max) as crew_max,
        COALESCE(rv.pledge_price, v.pledge_price) as pledge_price,
        COALESCE(rv.speed_scm, v.speed_scm) as speed_scm,
        COALESCE(rv.classification, v.classification) as classification,
        COALESCE(rm.name, m.name) as manufacturer_name,
        COALESCE(rm.code, m.code) as manufacturer_code,
        it.label as insurance_label, it.duration_months, it.is_lifetime,
        p.name as paint_name,
        COALESCE(rps.key, ps.key) as production_status,
        CASE WHEN v.replaced_by_vehicle_id IS NOT NULL THEN v.name END as original_vehicle_name
      FROM user_fleet uf
      JOIN vehicles v ON v.id = uf.vehicle_id
      LEFT JOIN vehicles rv ON rv.id = v.replaced_by_vehicle_id
      LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
      LEFT JOIN manufacturers rm ON rm.id = rv.manufacturer_id
      LEFT JOIN insurance_types it ON it.id = uf.insurance_type_id
      LEFT JOIN paints p ON p.id = uf.equipped_paint_id
      LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
      LEFT JOIN production_statuses rps ON rps.id = rv.production_status_id
      WHERE uf.user_id = ?
      ORDER BY COALESCE(rv.name, v.name)`,
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
        COALESCE(rv.name, v.name) as vehicle_name,
        COALESCE(rv.slug, v.slug) as vehicle_slug,
        COALESCE(rv.focus, v.focus) as focus,
        COALESCE(rv.size_label, v.size_label) as size_label,
        COALESCE(rv.cargo, v.cargo) as cargo,
        COALESCE(rv.crew_min, v.crew_min) as crew_min,
        COALESCE(rv.crew_max, v.crew_max) as crew_max,
        COALESCE(rv.pledge_price, v.pledge_price) as pledge_price,
        COALESCE(rv.speed_scm, v.speed_scm) as speed_scm,
        COALESCE(rv.classification, v.classification) as classification,
        COALESCE(rm.name, m.name) as manufacturer_name,
        COALESCE(rm.code, m.code) as manufacturer_code,
        it.label as insurance_label, it.duration_months, it.is_lifetime,
        COALESCE(rps.key, ps.key) as production_status
      FROM user_fleet uf
      JOIN vehicles v ON v.id = uf.vehicle_id
      LEFT JOIN vehicles rv ON rv.id = v.replaced_by_vehicle_id
      LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
      LEFT JOIN manufacturers rm ON rm.id = rv.manufacturer_id
      LEFT JOIN insurance_types it ON it.id = uf.insurance_type_id
      LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
      LEFT JOIN production_statuses rps ON rps.id = rv.production_status_id
      WHERE uf.user_id = ?
      ORDER BY COALESCE(rv.name, v.name)`,
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

export async function getGameVersions(db: D1Database): Promise<{ code: string; channel: string; is_default: number; released_at: string; build_number: string | null }[]> {
  const result = await db
    .prepare(`SELECT code, channel, is_default, released_at, build_number FROM game_versions ORDER BY id DESC`)
    .all<{ code: string; channel: string; is_default: number; released_at: string; build_number: string | null }>();
  return result.results;
}

export async function getLootItems(db: D1Database): Promise<LootItem[]> {
  const sql = `SELECT lm.id, lm.uuid, lm.name, lm.type, lm.sub_type, lm.rarity,
        lm.category, lm.manufacturer_name,
        ${LOOT_HAS_FLAGS},
        ${LOOT_SUMMARY_COLS}
      FROM loot_map lm
      ${LOOT_SUMMARY_JOINS}
      WHERE lm.name NOT IN ('<= PLACEHOLDER =>')
        AND lm.name NOT LIKE 'EntityClassDefinition.%'
        AND lm.type IS NOT NULL AND lm.type != ''
        AND lm.type NOT IN (
          'NOITEM_Vehicle','UNDEFINED',
          'Char_Skin_Color','Char_Head_Hair','Char_Hair_Color',
          'Char_Head_Eyes','Char_Body','Char_Head_Eyelash',
          'Currency','MobiGlas'
        )
      ORDER BY lm.name ASC`;
  const result = await db.prepare(sql).all();
  return result.results as unknown as LootItem[];
}

export async function getLootByUuid(db: D1Database, uuid: string): Promise<Record<string, unknown> | null> {
  const sql = `SELECT lm.*
      FROM loot_map lm
      WHERE lm.uuid = ?`;
  const row = await db.prepare(sql).bind(uuid).first();
  if (!row) return null;

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
        LEFT JOIN loot_map mag_lm ON mag_lm.uuid = fw.magazine_uuid
        WHERE fw.id = ?`)
      .bind(item.fps_weapon_id)
      .first() as Record<string, unknown> | null;
  } else if (item.fps_melee_id) {
    details = await db
      .prepare("SELECT name, sub_type as type, size, description, damage, heavy_damage, damage_type, attack_types, can_block, can_takedown FROM fps_melee WHERE id = ?")
      .bind(item.fps_melee_id)
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
      .prepare("SELECT name, slot, sub_type, size, grade, description, resist_physical, resist_energy, resist_distortion, resist_thermal, resist_biochemical, resist_stun, ir_emission, em_emission, storage_capacity, temperature_range_min, temperature_range_max FROM fps_clothing WHERE id = ?")
      .bind(item.fps_clothing_id)
      .first() as Record<string, unknown> | null;
  } else if (item.fps_carryable_id) {
    details = await db
      .prepare("SELECT name, sub_type as type, description, mass, interaction_type, value FROM fps_carryables WHERE id = ?")
      .bind(item.fps_carryable_id)
      .first() as Record<string, unknown> | null;
  } else if (item.consumable_id) {
    details = await db
      .prepare("SELECT name, type, sub_type, description, uuid FROM consumables WHERE id = ?")
      .bind(item.consumable_id)
      .first() as Record<string, unknown> | null;
    if (details?.uuid) {
      const effects = await db
        .prepare(`SELECT effect_key, magnitude, duration_seconds FROM consumable_effects WHERE consumable_uuid = ?`)
        .bind(details.uuid as string)
        .all();
      (details as Record<string, unknown>).effects = effects.results;
      delete (details as Record<string, unknown>).uuid;
    }
  }

  // Fallback: magazines have no FK from loot_map — match by UUID to fps_ammo_types
  if (!details && item.sub_type === 'Magazine') {
    details = await db
      .prepare(`SELECT COALESCE(fa.display_name, fa.name) as name, fa.caliber, fa.damage_per_round, fa.damage_type, fa.projectile_speed, fa.magazine_capacity FROM fps_ammo_types fa WHERE fa.uuid = ?`)
      .bind(uuid)
      .first() as Record<string, unknown> | null;
  }

  // Fallback: fetch consumable effects directly by loot_map UUID when consumable_id FK is null
  // (medical pens exist in consumable_effects but not in the consumables table)
  if (!details?.effects && (item.type === 'FPS_Consumable' || item.category === 'Consumable')) {
    const effects = await db
      .prepare(`SELECT effect_key, magnitude, duration_seconds FROM consumable_effects WHERE consumable_uuid = ?`)
      .bind(uuid)
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
      .prepare(`SELECT vc.name, vc.type, vc.sub_type, vc.size, vc.grade, vc.description,
        vc.power_draw, vc.thermal_output,
        cp.power_output, cp.overpower_performance, cp.overclock_performance,
        cp.overclock_threshold_min, cp.overclock_threshold_max,
        cc.cooling_rate, cc.max_temperature, cc.overheat_temperature,
        cs.shield_hp, cs.shield_regen, cs.resist_physical, cs.resist_energy,
        cs.resist_distortion, cs.resist_thermal, cs.regen_delay, cs.downed_regen_delay,
        cq.quantum_speed, cq.quantum_range, cq.fuel_rate, cq.spool_time, cq.cooldown_time,
        cq.calibration_rate, cq.engage_speed, cq.stage1_accel, cq.stage2_accel,
        cw.rounds_per_minute, cw.ammo_container_size, cw.damage_per_shot, cw.damage_type,
        cw.projectile_speed, cw.effective_range, cw.dps, cw.heat_per_shot, cw.fire_modes,
        ct.rotation_speed, ct.min_pitch, ct.max_pitch, ct.min_yaw, ct.max_yaw, ct.gimbal_type,
        cth.thrust_force, cth.fuel_burn_rate,
        cr.radar_range, cr.radar_angle,
        ce.qed_range, ce.qed_strength
      FROM vehicle_components vc
      LEFT JOIN component_powerplants cp ON cp.component_id = vc.id
      LEFT JOIN component_coolers cc ON cc.component_id = vc.id
      LEFT JOIN component_shields cs ON cs.component_id = vc.id
      LEFT JOIN component_quantum_drives cq ON cq.component_id = vc.id
      LEFT JOIN component_weapons cw ON cw.component_id = vc.id
      LEFT JOIN component_turrets ct ON ct.component_id = vc.id
      LEFT JOIN component_thrusters cth ON cth.component_id = vc.id
      LEFT JOIN component_radar cr ON cr.component_id = vc.id
      LEFT JOIN component_qed ce ON ce.component_id = vc.id
      WHERE vc.id = ?`)
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

  // Enrich with shop availability — which shops sell this item and at what price
  const shopAvailability = await db.prepare(`
    SELECT si.buy_price, si.sell_price, s.name AS shop_name, s.slug AS shop_slug,
           s.location_label, s.display_name
    FROM shop_inventory si
    JOIN shops s ON s.id = si.shop_id
    WHERE si.item_uuid = ?
      AND (si.buy_price > 0 OR si.sell_price > 0)
    ORDER BY s.location_label, s.name
  `).bind(uuid).all();

  for (const shop of shopAvailability.results) {
    const r = shop as Record<string, unknown>;
    locationsByType.shops.push({
      source_type: 'shop',
      location_key: r.shop_slug || r.shop_name,
      shop_name: r.display_name || r.shop_name,
      shop_slug: r.shop_slug,
      location_label: r.location_label,
      buy_price: r.buy_price,
      sell_price: r.sell_price,
    });
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
      ORDER BY nf.name, nl.loadout_name
    `).bind(itemName).all();

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
        ${LOOT_SUMMARY_COLS},
        ulw.quantity as wishlist_quantity
      FROM user_loot_wishlist ulw
      JOIN loot_map lm ON lm.id = ulw.loot_map_id
      ${LOOT_SUMMARY_JOINS}
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
): Promise<LootSetSummary[]> {
  const sql = `SELECT lm.id, lm.uuid, lm.name, lm.category, lm.manufacturer_name
    FROM loot_map lm
    WHERE lm.category IN ('armour', 'helmet', 'undersuit')
      AND lm.name NOT IN ('<= PLACEHOLDER =>')
      AND lm.type IS NOT NULL AND lm.type != ''
    ORDER BY lm.name ASC`;
  const result = await db.prepare(sql).all();

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
): Promise<LootSetDetail | null> {
  const sql = `SELECT lm.*,
      ${LOOT_HAS_FLAGS}
    FROM loot_map lm
    WHERE lm.category IN ('armour', 'helmet', 'undersuit')
      AND lm.name NOT IN ('<= PLACEHOLDER =>')
      AND lm.type IS NOT NULL AND lm.type != ''
    ORDER BY lm.name ASC`;
  const result = await db.prepare(sql).all();

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

/** Shared loot exclusion filters (applied in WHERE). */
const LOOT_EXCLUSION_FILTER = `lm.name NOT IN ('<= PLACEHOLDER =>')
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
export async function getLootLocationSummary(db: D1Database): Promise<LootLocationSummaryResult> {
  const sql = `SELECT lil.source_type, lil.location_key as key,
      COUNT(DISTINCT lil.loot_map_id) as itemCount,
      SUM(CASE WHEN COALESCE(lm.rarity, 'Common') = 'Common' THEN 1 ELSE 0 END) as r_Common,
      SUM(CASE WHEN lm.rarity = 'Uncommon' THEN 1 ELSE 0 END) as r_Uncommon,
      SUM(CASE WHEN lm.rarity = 'Rare' THEN 1 ELSE 0 END) as r_Rare,
      SUM(CASE WHEN lm.rarity = 'Epic' THEN 1 ELSE 0 END) as r_Epic,
      SUM(CASE WHEN lm.rarity = 'Legendary' THEN 1 ELSE 0 END) as r_Legendary
    FROM loot_item_locations lil
    JOIN loot_map lm ON lm.id = lil.loot_map_id
    WHERE lil.location_key != ''
      AND ${LOOT_EXCLUSION_FILTER}
    GROUP BY lil.source_type, lil.location_key`;

  const result = await db.prepare(sql).all<LocationAggRow & { source_type: string }>();

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
  locType: "container" | "shop" | "npc" | "contract",
  slug: string,
): Promise<LocationDetailResult> {
  const sourceType = locType; // 'container', 'shop', 'npc' — matches junction table values

  // Source-specific columns from junction table
  const extraCols =
    locType === "container"
      ? ", lil.per_container, lil.container_type"
    : locType === "shop"
      ? ", lil.buy_price"
    : ", lil.probability, lil.slot";

  const sql = `SELECT DISTINCT
      lm.uuid, lm.name, lm.type, lm.sub_type, lm.rarity, lm.category
      ${extraCols}
    FROM loot_item_locations lil
    JOIN loot_map lm ON lm.id = lil.loot_map_id
    WHERE lil.source_type = ?
      AND lil.location_key = ?
      AND ${LOOT_EXCLUSION_FILTER}
    ORDER BY lm.name`;

  const result = await db.prepare(sql).bind(sourceType, slug).all<{
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
       WHERE v.slug = ?
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
       JOIN vehicles v ON v.id = ss.base_vehicle_id
       LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
       WHERE ss.base_vehicle_id IS NOT NULL
       GROUP BY v.id
       ORDER BY v.name`,
    )
    .all();

  return results;
}
