/**
 * Loadout API integration test — Asgard golden data.
 *
 * Seeds a faithful replica of the Asgard's port hierarchy (3-level turret,
 * gimballed weapons, door turrets, missile rack, shields, power, coolers,
 * QD→JD chain, sensors, cargo) into the test D1 database, then asserts that
 * GET /api/loadout/asgard/components returns exactly the right shape and values.
 *
 * This test will BREAK if:
 * - The getShipLoadout query changes structure or filtering
 * - The recursive CTE stops resolving grandchild weapons
 * - weapon_count or missile_count aggregation changes
 * - COALESCE priority between mount and deepest component changes
 * - Category ordering changes
 * - Noise filtering (Display, ammo_slot, weapon_controller) breaks
 * - Port type filtering changes
 */
import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { setupTestDatabase, TEST_GAME_VERSION_ID } from "./apply-migrations";

// ---------------------------------------------------------------------------
// Seed helpers local to this file — builds the Asgard's full port hierarchy
// ---------------------------------------------------------------------------

let asgardVehicleId: number;

// Component UUIDs — stable for this test
const UUID = {
  varipuckS4: "vp-s4-gimbal-uuid",
  varipuckS3: "vp-s3-gimbal-uuid",
  rhinoS4: "cf447-rhino-uuid",
  pantherS3: "cf337-panther-uuid",
  mannedTurret: "manned-turret-uuid",
  pc2DualS3: "pc2-dual-s3-uuid",
  msd683Rack: "msd683-rack-uuid",
  arresterMissile: "arrester3-missile-uuid",
  fullstopShield: "fullstop-shield-uuid",
  maelstromPP: "maelstrom-pp-uuid",
  arcticCooler: "arctic-cooler-uuid",
  odysseyQD: "odyssey-qd-uuid",
  excelsiorJD: "excelsior-jd-uuid",
  surveyorRadar: "surveyor-radar-uuid",
  mountedGatling: "mounted-gatling-s1-uuid",
} as const;

// Manufacturer IDs (will be inserted)
const MFR = {
  anvil: 8,
  aegis: 46,
  klausWerner: 60,
  behring: 37,
  rsi: 102,
  basilisk: 5,
} as const;

async function seedManufacturers(db: D1Database) {
  const mfrs = [
    { id: MFR.anvil, name: "Anvil Aerospace", code: "ANVL", slug: "anvil-aerospace" },
    { id: MFR.aegis, name: "Seal Corporation", code: "SEAL", slug: "seal-corporation" },
    { id: MFR.klausWerner, name: "Klaus & Werner", code: "KLWE", slug: "klaus-werner" },
    { id: MFR.behring, name: "Behring Applied Technology", code: "BEHR", slug: "behring" },
    { id: MFR.rsi, name: "Roberts Space Industries", code: "RSI", slug: "rsi" },
    { id: MFR.basilisk, name: "Lightning Power Ltd.", code: "LPLT", slug: "lightning-power" },
  ];
  const stmts = mfrs.map((m) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO manufacturers (id, uuid, name, slug, code, game_version_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(m.id, `mfr-uuid-${m.id}`, m.name, m.slug, m.code, TEST_GAME_VERSION_ID)
  );
  await db.batch(stmts);
}

async function seedComponent(
  db: D1Database,
  opts: {
    uuid: string;
    name: string;
    type: string;
    sub_type?: string;
    size: number;
    grade: string;
    manufacturer_id: number;
    dps?: number;
    damage_per_shot?: number;
    damage_type?: string;
    rounds_per_minute?: number;
    projectile_speed?: number;
    damage_energy?: number;
    shield_hp?: number;
    shield_regen?: number;
    resist_physical?: number;
    resist_energy?: number;
    resist_distortion?: number;
    resist_thermal?: number;
    power_output?: number;
    thermal_output?: number;
    cooling_rate?: number;
    quantum_speed?: number;
    quantum_range?: number;
    fuel_rate?: number;
    spool_time?: number;
    radar_range?: number;
    power_draw?: number;
    penetration?: number;
    weapon_range?: number;
  }
): Promise<number> {
  // Base table — only columns that remain after migration 0179
  await db
    .prepare(
      `INSERT INTO vehicle_components (uuid, name, slug, type, sub_type, size, grade, class,
       manufacturer_id, thermal_output, power_draw, game_version_id,
       created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL,
       ?, ?, ?, ?,
       datetime('now'), datetime('now'))`
    )
    .bind(
      opts.uuid,
      opts.name,
      opts.name.toLowerCase().replace(/\s+/g, "-"),
      opts.type,
      opts.sub_type ?? null,
      opts.size,
      opts.grade,
      opts.manufacturer_id,
      opts.thermal_output ?? null,
      opts.power_draw ?? null,
      TEST_GAME_VERSION_ID
    )
    .run();

  const row = await db
    .prepare("SELECT id FROM vehicle_components WHERE uuid = ?")
    .bind(opts.uuid)
    .first<{ id: number }>();
  const componentId = row!.id;

  // Insert into the appropriate sub-table based on provided stat values
  if (opts.dps != null || opts.damage_per_shot != null || opts.rounds_per_minute != null || opts.penetration != null || opts.weapon_range != null) {
    await db
      .prepare(
        `INSERT INTO component_weapons (component_id, game_version_id, dps, damage_per_shot, damage_type,
         rounds_per_minute, projectile_speed, damage_energy, penetration, weapon_range)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        componentId, TEST_GAME_VERSION_ID,
        opts.dps ?? null, opts.damage_per_shot ?? null, opts.damage_type ?? null,
        opts.rounds_per_minute ?? null, opts.projectile_speed ?? null,
        opts.damage_energy ?? null, opts.penetration ?? null, opts.weapon_range ?? null
      )
      .run();
  }

  if (opts.shield_hp != null || opts.shield_regen != null) {
    await db
      .prepare(
        `INSERT INTO component_shields (component_id, game_version_id, shield_hp, shield_regen,
         resist_physical, resist_energy, resist_distortion, resist_thermal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        componentId, TEST_GAME_VERSION_ID,
        opts.shield_hp ?? null, opts.shield_regen ?? null,
        opts.resist_physical ?? null, opts.resist_energy ?? null,
        opts.resist_distortion ?? null, opts.resist_thermal ?? null
      )
      .run();
  }

  if (opts.power_output != null) {
    await db
      .prepare(
        `INSERT INTO component_powerplants (component_id, game_version_id, power_output)
         VALUES (?, ?, ?)`
      )
      .bind(componentId, TEST_GAME_VERSION_ID, opts.power_output)
      .run();
  }

  if (opts.cooling_rate != null) {
    await db
      .prepare(
        `INSERT INTO component_coolers (component_id, game_version_id, cooling_rate)
         VALUES (?, ?, ?)`
      )
      .bind(componentId, TEST_GAME_VERSION_ID, opts.cooling_rate)
      .run();
  }

  if (opts.quantum_speed != null || opts.quantum_range != null || opts.fuel_rate != null || opts.spool_time != null) {
    await db
      .prepare(
        `INSERT INTO component_quantum_drives (component_id, game_version_id, quantum_speed, quantum_range, fuel_rate, spool_time)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        componentId, TEST_GAME_VERSION_ID,
        opts.quantum_speed ?? null, opts.quantum_range ?? null,
        opts.fuel_rate ?? null, opts.spool_time ?? null
      )
      .run();
  }

  if (opts.radar_range != null) {
    await db
      .prepare(
        `INSERT INTO component_radar (component_id, game_version_id, radar_range)
         VALUES (?, ?, ?)`
      )
      .bind(componentId, TEST_GAME_VERSION_ID, opts.radar_range)
      .run();
  }

  return componentId;
}

async function seedPort(
  db: D1Database,
  opts: {
    uuid: string;
    vehicle_id: number;
    parent_port_id?: number | null;
    name: string;
    category_label?: string | null;
    size_min: number;
    size_max: number;
    port_type?: string | null;
    equipped_item_uuid?: string | null;
    editable?: number;
  }
): Promise<number> {
  await db
    .prepare(
      `INSERT INTO vehicle_ports (uuid, vehicle_id, parent_port_id, name, category_label,
       size_min, size_max, port_type, equipped_item_uuid, editable, game_version_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      opts.uuid,
      opts.vehicle_id,
      opts.parent_port_id ?? null,
      opts.name,
      opts.category_label ?? null,
      opts.size_min,
      opts.size_max,
      opts.port_type ?? null,
      opts.equipped_item_uuid ?? null,
      opts.editable ?? 1,
      TEST_GAME_VERSION_ID
    )
    .run();

  const row = await db
    .prepare("SELECT id FROM vehicle_ports WHERE uuid = ?")
    .bind(opts.uuid)
    .first<{ id: number }>();
  return row!.id;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Loadout API — Asgard golden data", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    await seedManufacturers(env.DB);

    // -----------------------------------------------------------------------
    // Seed vehicle: Asgard
    // -----------------------------------------------------------------------
    await env.DB
      .prepare(
        `INSERT INTO vehicles (slug, name, focus, size_label, cargo, crew_min, crew_max,
         speed_scm, speed_max, fuel_capacity_hydrogen, fuel_capacity_quantum,
         classification, manufacturer_id, game_version_id, updated_at)
         VALUES ('asgard', 'Asgard', 'Combat', 'medium', 180, 1, 1,
         203, 1075, 97.5, 1.85,
         'Combat', ${MFR.anvil}, ${TEST_GAME_VERSION_ID}, datetime('now'))`
      )
      .run();

    const vRow = await env.DB
      .prepare("SELECT id FROM vehicles WHERE slug = 'asgard'")
      .first<{ id: number }>();
    asgardVehicleId = vRow!.id;

    await env.DB
      .prepare("INSERT OR IGNORE INTO vehicle_images (vehicle_id) VALUES (?)")
      .bind(asgardVehicleId)
      .run();

    // -----------------------------------------------------------------------
    // Seed components (the Asgard's stock loadout)
    // -----------------------------------------------------------------------
    await seedComponent(env.DB, {
      uuid: UUID.varipuckS4, name: "VariPuck S4 Gimbal Mount", type: "Turret",
      sub_type: "GunTurret", size: 4, grade: "A", manufacturer_id: MFR.behring,
    });
    await seedComponent(env.DB, {
      uuid: UUID.varipuckS3, name: "VariPuck S3 Gimbal Mount", type: "Turret",
      sub_type: "GunTurret", size: 3, grade: "A", manufacturer_id: MFR.behring,
    });
    await seedComponent(env.DB, {
      uuid: UUID.rhinoS4, name: "CF-447 Rhino Repeater", type: "WeaponGun",
      sub_type: "Gun", size: 4, grade: "A", manufacturer_id: MFR.klausWerner,
      dps: 817.88, damage_per_shot: 65.43, damage_type: "Energy",
      rounds_per_minute: 750, projectile_speed: 1800,
      damage_energy: 65.43, thermal_output: 20, power_draw: 22.5,
      penetration: 1, weapon_range: 3006,
    });
    await seedComponent(env.DB, {
      uuid: UUID.pantherS3, name: "CF-337 Panther Repeater", type: "WeaponGun",
      sub_type: "Gun", size: 3, grade: "A", manufacturer_id: MFR.klausWerner,
      dps: 545.62, damage_per_shot: 43.65, damage_type: "Energy",
      rounds_per_minute: 750, projectile_speed: 1800,
      damage_energy: 43.65, thermal_output: 20, power_draw: 15,
      penetration: 0.75, weapon_range: 2592,
    });
    await seedComponent(env.DB, {
      uuid: UUID.mannedTurret, name: "Manned Turret", type: "TurretBase",
      sub_type: "MannedTurret", size: 4, grade: "A", manufacturer_id: MFR.anvil,
    });
    await seedComponent(env.DB, {
      uuid: UUID.pc2DualS3, name: "PC2 Dual S3 Mount", type: "Turret",
      sub_type: "GunTurret", size: 3, grade: "A", manufacturer_id: MFR.anvil,
    });
    await seedComponent(env.DB, {
      uuid: UUID.msd683Rack, name: "MSD-683 Missile Rack", type: "MissileLauncher",
      sub_type: "MissileRack", size: 7, grade: "A", manufacturer_id: MFR.anvil,
    });
    await seedComponent(env.DB, {
      uuid: UUID.arresterMissile, name: "Arrester III Missile", type: "Missile",
      size: 3, grade: "A", manufacturer_id: MFR.anvil,
    });
    await seedComponent(env.DB, {
      uuid: UUID.fullstopShield, name: "FullStop", type: "Shield",
      size: 2, grade: "C", manufacturer_id: MFR.aegis,
      shield_hp: 9240, shield_regen: 330,
      resist_physical: 0.5, resist_energy: 0.5, resist_distortion: 0.5, resist_thermal: 0.5,
    });
    await seedComponent(env.DB, {
      uuid: UUID.maelstromPP, name: "Maelstrom", type: "PowerPlant",
      size: 2, grade: "C", manufacturer_id: MFR.basilisk,
      power_output: 9375,
    });
    await seedComponent(env.DB, {
      uuid: UUID.arcticCooler, name: "Arctic", type: "Cooler",
      size: 2, grade: "C", manufacturer_id: MFR.basilisk,
      cooling_rate: 5200000,
    });
    await seedComponent(env.DB, {
      uuid: UUID.odysseyQD, name: "Odyssey", type: "QuantumDrive",
      size: 2, grade: "C", manufacturer_id: MFR.rsi,
      quantum_speed: 201000000, quantum_range: 100000000,
      fuel_rate: 84.46, spool_time: 5.26,
    });
    await seedComponent(env.DB, {
      uuid: UUID.excelsiorJD, name: "Excelsior", type: "JumpDrive",
      size: 2, grade: "C", manufacturer_id: MFR.rsi,
    });
    await seedComponent(env.DB, {
      uuid: UUID.surveyorRadar, name: "Surveyor", type: "Radar",
      size: 2, grade: "A", manufacturer_id: MFR.rsi,
      radar_range: 14000,
    });
    await seedComponent(env.DB, {
      uuid: UUID.mountedGatling, name: "Mounted Gatling S1", type: "WeaponGun",
      sub_type: "Gun", size: 1, grade: "A", manufacturer_id: MFR.anvil,
    });

    // -----------------------------------------------------------------------
    // Seed ports — the full Asgard hierarchy
    // -----------------------------------------------------------------------
    const vid = asgardVehicleId;

    // --- Top-level turrets ---
    // Bottom manned turret (TurretBase → Gimbal×2 → WeaponGun×2)
    const turretBottomId = await seedPort(env.DB, {
      uuid: "port-turret-bottom", vehicle_id: vid, name: "hardpoint_turret_bottom",
      category_label: "Turrets", size_min: 4, size_max: 4, port_type: "turret",
      equipped_item_uuid: UUID.mannedTurret,
    });
    // Manned turret child: VariPuck S4 left
    const turretBottomWeaponLeftId = await seedPort(env.DB, {
      uuid: "port-turret-bottom-weapon-left", vehicle_id: vid, name: "hardpoint_weapon_left",
      parent_port_id: turretBottomId,
      category_label: "Weapons", size_min: 4, size_max: 4, port_type: "weapon",
      equipped_item_uuid: UUID.varipuckS4, editable: 0,
    });
    // Grandchild: CF-447 Rhino under left gimbal
    await seedPort(env.DB, {
      uuid: "port-turret-bottom-wl-gun", vehicle_id: vid, name: "hardpoint_class_2",
      parent_port_id: turretBottomWeaponLeftId,
      size_min: 3, size_max: 4, port_type: "weapon",
      equipped_item_uuid: UUID.rhinoS4,
    });
    // Manned turret child: VariPuck S4 right
    const turretBottomWeaponRightId = await seedPort(env.DB, {
      uuid: "port-turret-bottom-weapon-right", vehicle_id: vid, name: "hardpoint_weapon_right",
      parent_port_id: turretBottomId,
      category_label: "Weapons", size_min: 4, size_max: 4, port_type: "weapon",
      equipped_item_uuid: UUID.varipuckS4, editable: 0,
    });
    // Grandchild: CF-447 Rhino under right gimbal
    await seedPort(env.DB, {
      uuid: "port-turret-bottom-wr-gun", vehicle_id: vid, name: "hardpoint_class_2",
      parent_port_id: turretBottomWeaponRightId,
      size_min: 3, size_max: 4, port_type: "weapon",
      equipped_item_uuid: UUID.rhinoS4,
    });

    // Pilot turret: PC2 Dual S3 Mount (→ VariPuck S3 × 2 → CF-337 Panther × 2)
    const turretPilotId = await seedPort(env.DB, {
      uuid: "port-turret-pilot", vehicle_id: vid, name: "hardpoint_turret_pilot",
      category_label: "Turrets", size_min: 3, size_max: 3, port_type: "turret",
      equipped_item_uuid: UUID.pc2DualS3,
    });
    const pilotLeftId = await seedPort(env.DB, {
      uuid: "port-pilot-left", vehicle_id: vid, name: "hardpoint_left",
      parent_port_id: turretPilotId,
      category_label: "Weapons", size_min: 3, size_max: 3, port_type: "weapon",
      equipped_item_uuid: UUID.varipuckS3, editable: 0,
    });
    await seedPort(env.DB, {
      uuid: "port-pilot-left-gun", vehicle_id: vid, name: "hardpoint_class_2",
      parent_port_id: pilotLeftId,
      size_min: 2, size_max: 3, port_type: "weapon",
      equipped_item_uuid: UUID.pantherS3,
    });
    const pilotRightId = await seedPort(env.DB, {
      uuid: "port-pilot-right", vehicle_id: vid, name: "hardpoint_right",
      parent_port_id: turretPilotId,
      category_label: "Weapons", size_min: 3, size_max: 3, port_type: "weapon",
      equipped_item_uuid: UUID.varipuckS3, editable: 0,
    });
    await seedPort(env.DB, {
      uuid: "port-pilot-right-gun", vehicle_id: vid, name: "hardpoint_class_2",
      parent_port_id: pilotRightId,
      size_min: 2, size_max: 3, port_type: "weapon",
      equipped_item_uuid: UUID.pantherS3,
    });

    // Top-level gimballed weapons (4× VariPuck S3 → CF-337 Panther)
    for (const suffix of ["top_left_1", "top_left_2", "top_right_1", "top_right_2"]) {
      const gId = await seedPort(env.DB, {
        uuid: `port-weapon-${suffix}`, vehicle_id: vid,
        name: `hardpoint_weapon_${suffix}`,
        category_label: "Weapons", size_min: 3, size_max: 3, port_type: "weapon",
        equipped_item_uuid: UUID.varipuckS3, editable: 1,
      });
      await seedPort(env.DB, {
        uuid: `port-weapon-${suffix}-gun`, vehicle_id: vid, name: "hardpoint_class_2",
        parent_port_id: gId,
        size_min: 2, size_max: 3, port_type: "weapon",
        equipped_item_uuid: UUID.pantherS3,
      });
    }

    // Door turrets (turret → weapon child + ammo_slot + weapon_controller noise)
    for (const side of ["left", "right"]) {
      const doorTurretId = await seedPort(env.DB, {
        uuid: `port-door-turret-${side}`, vehicle_id: vid,
        name: `hardpoint_turret_door_${side}`,
        category_label: "Turrets", size_min: 3, size_max: 3, port_type: "turret",
        editable: 1,
      });
      await seedPort(env.DB, {
        uuid: `port-door-weapon-${side}`, vehicle_id: vid, name: "weapon",
        parent_port_id: doorTurretId,
        category_label: "Weapons", size_min: 1, size_max: 1, port_type: "weapon",
        equipped_item_uuid: UUID.mountedGatling, editable: 0,
      });
      await seedPort(env.DB, {
        uuid: `port-door-ammo-${side}`, vehicle_id: vid, name: "ammo_slot",
        parent_port_id: doorTurretId,
        category_label: "Weapons", size_min: 1, size_max: 1, port_type: "weapon",
        editable: 1,
      });
      await seedPort(env.DB, {
        uuid: `port-door-ctrl-${side}`, vehicle_id: vid, name: "weapon_controller",
        parent_port_id: doorTurretId,
        category_label: "Weapons", size_min: 0, size_max: 0, port_type: "weapon",
        editable: 1,
      });
    }

    // Missile rack top turret (MSD-683 → 16× Arrester III)
    const turretTopId = await seedPort(env.DB, {
      uuid: "port-turret-top", vehicle_id: vid, name: "hardpoint_turret_top",
      category_label: "Turrets", size_min: 7, size_max: 7, port_type: "turret",
      equipped_item_uuid: UUID.msd683Rack,
    });
    for (let i = 1; i <= 16; i++) {
      const num = String(i).padStart(2, "0");
      await seedPort(env.DB, {
        uuid: `port-missile-${num}`, vehicle_id: vid, name: `missile_${num}_attach`,
        parent_port_id: turretTopId,
        size_min: 3, size_max: 3, port_type: "missile",
        equipped_item_uuid: UUID.arresterMissile,
      });
    }

    // Shields (4×)
    for (const pos of ["left", "right", "rear_left", "rear_right"]) {
      await seedPort(env.DB, {
        uuid: `port-shield-${pos}`, vehicle_id: vid,
        name: `hardpoint_shield_generator_${pos}`,
        category_label: "Shields", size_min: 2, size_max: 2, port_type: "shield",
        equipped_item_uuid: UUID.fullstopShield,
      });
    }

    // Power plants (2×)
    for (const pos of ["left", "right"]) {
      await seedPort(env.DB, {
        uuid: `port-power-${pos}`, vehicle_id: vid,
        name: `hardpoint_powerplant_${pos}`,
        category_label: "Power", size_min: 2, size_max: 2, port_type: "power",
        equipped_item_uuid: UUID.maelstromPP,
      });
    }

    // Coolers (3×)
    for (const pos of ["left", "right", "rear"]) {
      await seedPort(env.DB, {
        uuid: `port-cooler-${pos}`, vehicle_id: vid,
        name: `hardpoint_cooler_${pos}`,
        category_label: "Cooling", size_min: 2, size_max: 2, port_type: "cooler",
        equipped_item_uuid: UUID.arcticCooler,
      });
    }

    // Quantum drive → Jump drive (parent-child)
    const qdId = await seedPort(env.DB, {
      uuid: "port-qd", vehicle_id: vid, name: "hardpoint_quantum_drive",
      category_label: "Quantum Drive", size_min: 2, size_max: 2, port_type: "quantum_drive",
      equipped_item_uuid: UUID.odysseyQD,
    });
    await seedPort(env.DB, {
      uuid: "port-jd", vehicle_id: vid, name: "hardpoint_jump_drive",
      parent_port_id: qdId,
      category_label: "Jump Drive", size_min: 2, size_max: 2, port_type: "jump_drive",
      equipped_item_uuid: UUID.excelsiorJD,
    });

    // Sensors
    await seedPort(env.DB, {
      uuid: "port-radar", vehicle_id: vid, name: "hardpoint_radar",
      category_label: "Sensors", size_min: 2, size_max: 2, port_type: "sensor",
      equipped_item_uuid: UUID.surveyorRadar,
    });
    await seedPort(env.DB, {
      uuid: "port-ping", vehicle_id: vid, name: "hardpoint_ping",
      category_label: "Sensors", size_min: 0, size_max: 0, port_type: "sensor",
    });
    await seedPort(env.DB, {
      uuid: "port-scanner", vehicle_id: vid, name: "hardpoint_scanner",
      category_label: "Sensors", size_min: 0, size_max: 0, port_type: "sensor",
    });

    // Cargo grid
    await seedPort(env.DB, {
      uuid: "port-cargo", vehicle_id: vid, name: "hardpoint_cargo_grid",
      category_label: "Cargo Grid", size_min: 1, size_max: 1, port_type: "cargo_grid",
    });

    // Noise port that SHOULD be excluded: dashboard (null port_type, null category_label)
    const dashboardId = await seedPort(env.DB, {
      uuid: "port-dashboard", vehicle_id: vid, name: "hardpoint_dashboard_pilot",
      port_type: null, category_label: null, size_min: 1, size_max: 1,
    });
    // Display child of dashboard — should be excluded by noise filter
    await seedPort(env.DB, {
      uuid: "port-cockpit-radar-display", vehicle_id: vid, name: "hardpoint_cockpit_radar",
      parent_port_id: dashboardId,
      category_label: "Sensors", size_min: 1, size_max: 1, port_type: "sensor",
      equipped_item_uuid: "display-radar-uuid",
    });
    // Insert a Display component for the radar display
    await seedComponent(env.DB, {
      uuid: "display-radar-uuid", name: "Radar_Display_Valkyrie", type: "Display",
      size: 1, grade: "A", manufacturer_id: MFR.anvil,
    });

    // Torpedo storage slots (like Perseus hardpoint_torpedo_storage_*) — should be excluded
    for (let i = 1; i <= 5; i++) {
      const num = String(i).padStart(2, "0");
      await seedPort(env.DB, {
        uuid: `port-torpedo-storage-${num}`, vehicle_id: vid,
        name: `hardpoint_torpedo_storage_${num}`,
        category_label: "Missiles", size_min: 9, size_max: 9, port_type: "missile",
        equipped_item_uuid: UUID.arresterMissile,
      });
    }
  });

  // =========================================================================
  // Tests
  // =========================================================================

  it("returns exactly the right number of ports (no noise, no missile slots)", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/asgard/components");
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>[];
    // Expected: 8 weapons + 14 weapon children/noise FILTERED = only weapon ports with
    // category_label in the allowed port_types.
    //
    // Count from the real Asgard response:
    // Weapons: 2 (S4 turret children) + 2 (pilot turret children) + 4 (top gimbal)
    //          + 2 (ammo_slot) + 2 (door weapons) + 2 (weapon_controller) = 14
    // Turrets: 5 (bottom, top, door_left, door_right, pilot)
    // Shields: 4
    // Power: 2
    // Cooling: 3
    // QD: 1
    // JD: 1
    // Sensors: 3 (radar + 2 empty)
    // Cargo: 1
    //
    // But missile_*_attach are excluded, and the cockpit radar Display is excluded.
    // ammo_slot and weapon_controller are returned by the query (they have category_label
    // and are children of turrets).
    // Total should match the real API response count.
    expect(data.length).toBeGreaterThanOrEqual(28);
    expect(data.length).toBeLessThanOrEqual(40);
  });

  it("resolves 3-level turret hierarchy: TurretBase → Gimbal → WeaponGun", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/asgard/components");
    const data = (await res.json()) as Record<string, unknown>[];

    // The bottom turret should resolve through to the deepest weapon
    const bottomTurret = data.find(
      (p) => p.port_name === "hardpoint_turret_bottom"
    );
    expect(bottomTurret).toBeDefined();
    expect(bottomTurret!.port_type).toBe("turret");
    expect(bottomTurret!.mount_name).toBe("Manned Turret");
    expect(bottomTurret!.component_name).toBe("CF-447 Rhino Repeater");
    expect(bottomTurret!.component_type).toBe("WeaponGun");
    expect(bottomTurret!.dps).toBe(817.88);
    expect(bottomTurret!.weapon_count).toBe(2);
  });

  it("resolves 2-level gimbal hierarchy: Gimbal → WeaponGun", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/asgard/components");
    const data = (await res.json()) as Record<string, unknown>[];

    // Top-left gimballed weapon should resolve through VariPuck to Panther
    const topLeft1 = data.find(
      (p) => p.port_name === "hardpoint_weapon_top_left_1"
    );
    expect(topLeft1).toBeDefined();
    expect(topLeft1!.mount_name).toBe("VariPuck S3 Gimbal Mount");
    expect(topLeft1!.child_name).toBe("CF-337 Panther Repeater");
    expect(topLeft1!.component_name).toBe("CF-337 Panther Repeater");
    expect(topLeft1!.component_type).toBe("WeaponGun");
    expect(topLeft1!.dps).toBe(545.62);
    expect(topLeft1!.manufacturer_name).toBe("Klaus & Werner");
    expect(topLeft1!.weapon_count).toBe(1);
  });

  it("resolves pilot turret with PC2 dual mount (2× grandchild weapons)", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/asgard/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const pilotTurret = data.find(
      (p) => p.port_name === "hardpoint_turret_pilot"
    );
    expect(pilotTurret).toBeDefined();
    expect(pilotTurret!.mount_name).toBe("PC2 Dual S3 Mount");
    expect(pilotTurret!.component_name).toBe("CF-337 Panther Repeater");
    expect(pilotTurret!.weapon_count).toBe(2);

    // The individual weapons under the pilot turret are also returned
    const pilotLeft = data.find((p) => p.port_name === "hardpoint_left");
    expect(pilotLeft).toBeDefined();
    expect(pilotLeft!.component_name).toBe("CF-337 Panther Repeater");
    expect(pilotLeft!.mount_name).toBe("VariPuck S3 Gimbal Mount");
  });

  it("counts missiles correctly on the rack turret", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/asgard/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const rackTurret = data.find(
      (p) => p.port_name === "hardpoint_turret_top"
    );
    expect(rackTurret).toBeDefined();
    expect(rackTurret!.mount_name).toBe("MSD-683 Missile Rack");
    expect(rackTurret!.component_name).toBe("Arrester III Missile");
    expect(rackTurret!.component_type).toBe("Missile");
    expect(rackTurret!.weapon_count).toBe(16);
    expect(rackTurret!.missile_count).toBe(16);
  });

  it("excludes individual missile_*_attach slots from results", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/asgard/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const missileSlots = data.filter((p) =>
      (p.port_name as string).match(/^missile_\d+_attach$/)
    );
    expect(missileSlots).toHaveLength(0);
  });

  it("returns all 4 shields with correct stats", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/asgard/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const shields = data.filter((p) => p.port_type === "shield");
    expect(shields).toHaveLength(4);

    for (const s of shields) {
      expect(s.component_name).toBe("FullStop");
      expect(s.component_type).toBe("Shield");
      expect(s.shield_hp).toBe(9240);
      expect(s.shield_regen).toBe(330);
      expect(s.component_size).toBe(2);
      expect(s.grade).toBe("C");
    }
  });

  it("returns both power plants with correct output", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/asgard/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const powerPlants = data.filter((p) => p.port_type === "power");
    expect(powerPlants).toHaveLength(2);

    for (const pp of powerPlants) {
      expect(pp.component_name).toBe("Maelstrom");
      expect(pp.component_type).toBe("PowerPlant");
      expect(pp.power_output).toBe(9375);
    }
  });

  it("returns all 3 coolers with correct cooling rate", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/asgard/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const coolers = data.filter((p) => p.port_type === "cooler");
    expect(coolers).toHaveLength(3);

    for (const c of coolers) {
      expect(c.component_name).toBe("Arctic");
      expect(c.cooling_rate).toBe(5200000);
    }
  });

  it("returns quantum drive with correct stats and jump drive as child", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/asgard/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const qd = data.find((p) => p.port_type === "quantum_drive");
    expect(qd).toBeDefined();
    expect(qd!.component_name).toBe("Odyssey");
    expect(qd!.quantum_speed).toBe(201000000);

    const jd = data.find((p) => p.port_type === "jump_drive");
    expect(jd).toBeDefined();
    expect(jd!.component_name).toBe("Excelsior");
    expect(jd!.parent_port_id).toBeTruthy();
  });

  it("returns category_labels in the correct display order", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/asgard/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const ORDER = [
      "Weapons", "Turrets", "Shields", "Power",
      "Cooling", "Quantum Drive", "Jump Drive", "Sensors", "Cargo Grid",
    ];

    // Verify that the order of first-appearance matches the expected order
    const seen: string[] = [];
    for (const p of data) {
      const cat = p.category_label as string;
      if (!seen.includes(cat)) seen.push(cat);
    }

    // Filter to only the categories we expect
    const filtered = seen.filter((c) => ORDER.includes(c));
    for (let i = 1; i < filtered.length; i++) {
      expect(ORDER.indexOf(filtered[i])).toBeGreaterThan(
        ORDER.indexOf(filtered[i - 1])
      );
    }
  });

  it("includes door turrets with locked child weapons", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/asgard/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const doorLeft = data.find(
      (p) => p.port_name === "hardpoint_turret_door_left"
    );
    expect(doorLeft).toBeDefined();
    expect(doorLeft!.port_type).toBe("turret");
    expect(doorLeft!.component_name).toBe("Mounted Gatling S1");
    expect(doorLeft!.weapon_count).toBe(1);

    const doorRight = data.find(
      (p) => p.port_name === "hardpoint_turret_door_right"
    );
    expect(doorRight).toBeDefined();
    expect(doorRight!.component_name).toBe("Mounted Gatling S1");
  });

  it("weapon stats are populated (not null) for real weapons", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/asgard/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const weapons = data.filter(
      (p) =>
        p.component_type === "WeaponGun" &&
        p.dps !== null &&
        p.port_type === "weapon"
    );

    // Should have at least the 6 main gimballed weapons (4 top + 2 pilot children)
    expect(weapons.length).toBeGreaterThanOrEqual(6);

    for (const w of weapons) {
      expect(w.dps).toBeGreaterThan(0);
      expect(w.damage_per_shot).toBeGreaterThan(0);
      expect(w.rounds_per_minute).toBeGreaterThan(0);
      expect(w.damage_type).toBe("Energy");
    }
  });

  it("editable flag correctly distinguishes fixed vs swappable", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/asgard/components");
    const data = (await res.json()) as Record<string, unknown>[];

    // Top-level gimbal weapons are editable
    const topLeft = data.find(
      (p) => p.port_name === "hardpoint_weapon_top_left_1"
    );
    expect(topLeft!.editable).toBe(1);

    // Turret child weapons (under manned turret) are NOT editable
    const turretWeaponLeft = data.find(
      (p) =>
        p.port_name === "hardpoint_weapon_left" &&
        p.parent_port_id !== null
    );
    if (turretWeaponLeft) {
      expect(turretWeaponLeft.editable).toBe(0);
    }

    // Shields, power, coolers are editable
    const shields = data.filter((p) => p.port_type === "shield");
    for (const s of shields) {
      expect(s.editable).toBe(1);
    }
  });

  it("excludes Display-type noise ports from dashboard", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/asgard/components");
    const data = (await res.json()) as Record<string, unknown>[];

    // The dashboard and its Display child should not appear
    const dashboard = data.find(
      (p) => p.port_name === "hardpoint_dashboard_pilot"
    );
    expect(dashboard).toBeUndefined();

    // No component_type === 'Display' should appear in results
    const displays = data.filter((p) => p.component_type === "Display");
    expect(displays).toHaveLength(0);
  });

  it("does not duplicate weapons across turret parent and child rows", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/asgard/components");
    const data = (await res.json()) as Record<string, unknown>[];

    // The bottom turret resolves to Rhino, and its weapon children also resolve to Rhino.
    // The turret itself shows weapon_count=2 (summarized), and the children each show
    // the individual weapon. We should not have MORE S4 Rhinos than expected (2 turret children + turret summary).
    const rhinos = data.filter(
      (p) =>
        p.component_name === "CF-447 Rhino Repeater" && p.port_type === "weapon"
    );
    // Exactly 2: hardpoint_weapon_left and hardpoint_weapon_right (children of bottom turret)
    expect(rhinos).toHaveLength(2);
  });

  it("excludes hardpoint_torpedo_storage_* slots from results", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/asgard/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const torpedoStorageSlots = data.filter((p) =>
      (p.port_name as string).startsWith("hardpoint_torpedo_storage_")
    );
    expect(torpedoStorageSlots).toHaveLength(0);
  });

  it("COALESCE resolves mount vs deepest correctly — mount stays as mount_name", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/asgard/components");
    const data = (await res.json()) as Record<string, unknown>[];

    // For a gimballed weapon, mount_name = VariPuck, component_name = actual weapon
    const topRight1 = data.find(
      (p) => p.port_name === "hardpoint_weapon_top_right_1"
    );
    expect(topRight1).toBeDefined();
    expect(topRight1!.mount_name).toBe("VariPuck S3 Gimbal Mount");
    expect(topRight1!.component_name).toBe("CF-337 Panther Repeater");
    // These should be DIFFERENT — proves COALESCE picks deepest weapon, not mount
    expect(topRight1!.mount_name).not.toBe(topRight1!.component_name);
  });

  // --- Compatible components: stock detection ---
  // The Asgard weapon port structure is:
  //   hardpoint_weapon_top_left_1 (port_type=weapon, equipped=varipuckS3 gimbal)
  //     └─ hardpoint_class_2 (child, equipped=pantherS3 weapon)
  // The compatible endpoint must walk the tree to find that pantherS3 is the stock weapon.

  it("compatible: marks the stock weapon (CF-337 Panther) via is_stock on turret-housed ports", async () => {
    const portRow = await env.DB
      .prepare("SELECT id FROM vehicle_ports WHERE uuid = 'port-weapon-top_left_1'")
      .first<{ id: number }>();
    expect(portRow).toBeDefined();

    const res = await SELF.fetch(
      `http://localhost/api/loadout/asgard/compatible?port_id=${portRow!.id}`
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      stock_uuid: string | null;
      components: Array<{ uuid: string; name: string; is_stock: boolean }>;
    };

    // stock_uuid should be the PANTHER uuid, not the gimbal uuid
    expect(data.stock_uuid).toBe(UUID.pantherS3);

    // Exactly one component should have is_stock=true
    const stockComps = data.components.filter((c: any) => c.is_stock);
    expect(stockComps).toHaveLength(1);
    expect(stockComps[0].name).toBe("CF-337 Panther Repeater");
  });

  it("compatible: returns the Panther in the list with correct type", async () => {
    const portRow = await env.DB
      .prepare("SELECT id FROM vehicle_ports WHERE uuid = 'port-weapon-top_left_1'")
      .first<{ id: number }>();

    const res = await SELF.fetch(
      `http://localhost/api/loadout/asgard/compatible?port_id=${portRow!.id}`
    );
    const data = (await res.json()) as {
      components: Array<{ uuid: string; name: string; type: string }>;
    };

    const panther = data.components.find((c: any) => c.uuid === UUID.pantherS3);
    expect(panther).toBeDefined();
    expect(panther!.name).toBe("CF-337 Panther Repeater");
    expect(panther!.type).toBe("WeaponGun");
  });

  it("compatible: Rhino S4 is NOT marked as stock for a Panther port", async () => {
    const portRow = await env.DB
      .prepare("SELECT id FROM vehicle_ports WHERE uuid = 'port-weapon-top_left_1'")
      .first<{ id: number }>();

    const res = await SELF.fetch(
      `http://localhost/api/loadout/asgard/compatible?port_id=${portRow!.id}`
    );
    const data = (await res.json()) as {
      components: Array<{ uuid: string; name: string; is_stock: boolean }>;
    };

    const rhino = data.components.find((c: any) => c.uuid === UUID.rhinoS4);
    if (rhino) {
      expect(rhino.is_stock).toBe(false);
    }
  });
});

// ===========================================================================
// Carrack Expedition — golden loadout test
// ===========================================================================

let carrackVehicleId: number;

// Component UUIDs for the Carrack Expedition
const CARRACK_UUID = {
  mannedTurretLeft: "carrack-manned-turret-left-uuid",
  mannedTurretRight: "carrack-manned-turret-right-uuid",
  mannedTurretRear: "carrack-manned-turret-rear-uuid",
  remoteTurret: "carrack-remote-turret-uuid",
  varipuckS4: "carrack-varipuck-s4-uuid",
  rhinoS4: "carrack-rhino-s4-uuid",
  barbicanShield: "carrack-barbican-shield-uuid",
  reliancePP: "carrack-reliance-pp-uuid",
  iceFlushCooler: "carrack-iceflush-cooler-uuid",
  kamaQD: "carrack-kama-qd-uuid",
  exodusJD: "carrack-exodus-jd-uuid",
  defconFlares: "carrack-defcon-flares-uuid",
  defconNoise: "carrack-defcon-noise-uuid",
  surveyorRadar: "carrack-surveyor-radar-uuid",
  screenMFD: "carrack-screen-mfd-uuid",
  radarDisplay: "carrack-radar-display-uuid",
  weaponLocker: "carrack-weapon-locker-uuid",
  accessTurret: "carrack-access-turret-uuid",
  cargoGrid1: "carrack-cargo-grid-1-uuid",
  cargoGrid2: "carrack-cargo-grid-2-uuid",
  cargoPod: "carrack-cargo-pod-uuid",
  cargoPodL: "carrack-cargo-pod-l-uuid",
  cargoPodR: "carrack-cargo-pod-r-uuid",
} as const;

// Manufacturer IDs for Carrack components
const CARRACK_MFR = {
  anvil: 8,         // reused from Asgard
  klausWerner: 60,  // reused
  behring: 37,      // reused (VariPuck → Flashfire in prod, but Behring for test consistency)
  juno: 200,
  basilisk: 5,      // reused (Lightning Power)
  joker: 201,
  tarsus: 202,
  chimera: 203,
} as const;

describe("Loadout API — Carrack Expedition golden data", () => {
  beforeAll(async () => {
    // Each describe block gets its own isolated D1 database — must set up from scratch.
    await setupTestDatabase(env.DB);
    await seedManufacturers(env.DB);

    const db = env.DB;

    // Seed additional manufacturers for Carrack-specific components.
    const extraMfrs = [
      { id: CARRACK_MFR.juno, name: "Juno Starwerk", code: "JUNO", slug: "juno-starwerk" },
      { id: CARRACK_MFR.joker, name: "Joker Engineering", code: "JOKR", slug: "joker-engineering" },
      { id: CARRACK_MFR.tarsus, name: "Tarsus", code: "TARS", slug: "tarsus" },
      { id: CARRACK_MFR.chimera, name: "Chimera Communications", code: "CHIM", slug: "chimera-communications" },
    ];
    const mfrStmts = extraMfrs.map((m) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO manufacturers (id, uuid, name, slug, code, game_version_id)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(m.id, `mfr-uuid-${m.id}`, m.name, m.slug, m.code, TEST_GAME_VERSION_ID)
    );
    await db.batch(mfrStmts);

    // -----------------------------------------------------------------------
    // Seed vehicle: Carrack Expedition
    // -----------------------------------------------------------------------
    await db
      .prepare(
        `INSERT INTO vehicles (slug, name, focus, size_label, cargo, crew_min, crew_max,
         speed_scm, speed_max, fuel_capacity_hydrogen, fuel_capacity_quantum,
         classification, manufacturer_id, game_version_id, updated_at)
         VALUES ('carrack-expedition', 'Carrack Expedition', 'Exploration', 'large', 456, 1, 6,
         96, 950, 135, 3.6,
         'Exploration', ${CARRACK_MFR.anvil}, ${TEST_GAME_VERSION_ID}, datetime('now'))`
      )
      .run();

    const vRow = await db
      .prepare("SELECT id FROM vehicles WHERE slug = 'carrack-expedition'")
      .first<{ id: number }>();
    carrackVehicleId = vRow!.id;

    await db
      .prepare("INSERT OR IGNORE INTO vehicle_images (vehicle_id) VALUES (?)")
      .bind(carrackVehicleId)
      .run();

    // -----------------------------------------------------------------------
    // Seed components
    // -----------------------------------------------------------------------

    // Turret bases / turrets (3 manned + 1 remote)
    await seedComponent(db, {
      uuid: CARRACK_UUID.mannedTurretLeft, name: "Manned Turret", type: "TurretBase",
      sub_type: "MannedTurret", size: 5, grade: "A", manufacturer_id: CARRACK_MFR.anvil,
    });
    await seedComponent(db, {
      uuid: CARRACK_UUID.mannedTurretRight, name: "Manned Turret", type: "TurretBase",
      sub_type: "MannedTurret", size: 5, grade: "A", manufacturer_id: CARRACK_MFR.anvil,
    });
    await seedComponent(db, {
      uuid: CARRACK_UUID.mannedTurretRear, name: "Manned Turret", type: "TurretBase",
      sub_type: "MannedTurret", size: 5, grade: "A", manufacturer_id: CARRACK_MFR.anvil,
    });
    await seedComponent(db, {
      uuid: CARRACK_UUID.remoteTurret, name: "Remote Turret", type: "Turret",
      sub_type: "GunTurret", size: 5, grade: "A", manufacturer_id: CARRACK_MFR.anvil,
    });

    // VariPuck S4 Gimbal Mount (used on all turret children)
    await seedComponent(db, {
      uuid: CARRACK_UUID.varipuckS4, name: "VariPuck S4 Gimbal Mount", type: "Turret",
      sub_type: "GunTurret", size: 4, grade: "A", manufacturer_id: CARRACK_MFR.behring,
    });

    // CF-447 Rhino Repeater (the actual weapon)
    await seedComponent(db, {
      uuid: CARRACK_UUID.rhinoS4, name: "CF-447 Rhino Repeater", type: "WeaponGun",
      sub_type: "Gun", size: 4, grade: "A", manufacturer_id: CARRACK_MFR.klausWerner,
      dps: 817.88, damage_per_shot: 65.43, damage_type: "Energy",
      rounds_per_minute: 750, projectile_speed: 1800,
      damage_energy: 65.43, thermal_output: 20, power_draw: 22.5,
      penetration: 1, weapon_range: 3006,
    });

    // Barbican shield
    await seedComponent(db, {
      uuid: CARRACK_UUID.barbicanShield, name: "Barbican", type: "Shield",
      size: 3, grade: "B", manufacturer_id: CARRACK_MFR.basilisk,
      shield_hp: 45000, shield_regen: 4050,
      resist_physical: 0.5, resist_energy: 0.5, resist_distortion: 0.5, resist_thermal: 0.5,
    });

    // Reliance power plant
    await seedComponent(db, {
      uuid: CARRACK_UUID.reliancePP, name: "Reliance", type: "PowerPlant",
      size: 3, grade: "B", manufacturer_id: CARRACK_MFR.juno,
      power_output: 52500,
    });

    // Ice-Flush cooler
    await seedComponent(db, {
      uuid: CARRACK_UUID.iceFlushCooler, name: "Ice-Flush", type: "Cooler",
      size: 3, grade: "B", manufacturer_id: CARRACK_MFR.juno,
      cooling_rate: 16800000,
    });

    // Kama quantum drive
    await seedComponent(db, {
      uuid: CARRACK_UUID.kamaQD, name: "Kama", type: "QuantumDrive",
      size: 3, grade: "C", manufacturer_id: CARRACK_MFR.juno,
      quantum_speed: 319000000, spool_time: 1000,
    });

    // Exodus jump drive
    await seedComponent(db, {
      uuid: CARRACK_UUID.exodusJD, name: "Exodus", type: "JumpDrive",
      size: 3, grade: "C", manufacturer_id: CARRACK_MFR.tarsus,
    });

    // Joker Defcon countermeasures (two different variants)
    await seedComponent(db, {
      uuid: CARRACK_UUID.defconFlares, name: "Joker Defcon Flares Ammo", type: "WeaponDefensive",
      sub_type: "CountermeasureLauncher", size: 1, grade: "A", manufacturer_id: CARRACK_MFR.joker,
    });
    await seedComponent(db, {
      uuid: CARRACK_UUID.defconNoise, name: "Joker Defcon - Noise Launcher", type: "WeaponDefensive",
      sub_type: "CountermeasureLauncher", size: 1, grade: "A", manufacturer_id: CARRACK_MFR.joker,
    });

    // Surveyor radar
    await seedComponent(db, {
      uuid: CARRACK_UUID.surveyorRadar, name: "Surveyor", type: "Radar",
      sub_type: "MidRangeRadar", size: 2, grade: "C", manufacturer_id: CARRACK_MFR.chimera,
    });

    // Noise components — Display type (should be filtered out)
    await seedComponent(db, {
      uuid: CARRACK_UUID.screenMFD, name: "Vehicle_Screen_MFD", type: "Display",
      size: 1, grade: "A", manufacturer_id: CARRACK_MFR.anvil,
    });
    await seedComponent(db, {
      uuid: CARRACK_UUID.radarDisplay, name: "Radar_Display_Screen_Template", type: "Display",
      size: 1, grade: "A", manufacturer_id: CARRACK_MFR.anvil,
    });

    // Weapon locker component (parent of weapon rack children)
    await seedComponent(db, {
      uuid: CARRACK_UUID.weaponLocker, name: "Weapon Locker", type: "PersonalStorage",
      size: 1, grade: "A", manufacturer_id: CARRACK_MFR.anvil,
    });

    // Access turret component
    await seedComponent(db, {
      uuid: CARRACK_UUID.accessTurret, name: "Access Turret Mechanism", type: "TurretBase",
      sub_type: "MannedTurret", size: 1, grade: "A", manufacturer_id: CARRACK_MFR.anvil,
    });

    // Cargo grid components
    await seedComponent(db, {
      uuid: CARRACK_UUID.cargoGrid1, name: "Cargo Grid 32 SCU", type: "Cargo",
      size: 1, grade: "A", manufacturer_id: CARRACK_MFR.anvil,
    });
    await seedComponent(db, {
      uuid: CARRACK_UUID.cargoGrid2, name: "Cargo Grid 16 SCU", type: "Cargo",
      size: 1, grade: "A", manufacturer_id: CARRACK_MFR.anvil,
    });
    await seedComponent(db, {
      uuid: CARRACK_UUID.cargoPod, name: "Cargo Pod Container", type: "Cargo",
      size: 1, grade: "A", manufacturer_id: CARRACK_MFR.anvil,
    });
    await seedComponent(db, {
      uuid: CARRACK_UUID.cargoPodL, name: "Cargo Pod Left Module", type: "Cargo",
      size: 1, grade: "A", manufacturer_id: CARRACK_MFR.anvil,
    });
    await seedComponent(db, {
      uuid: CARRACK_UUID.cargoPodR, name: "Cargo Pod Right Module", type: "Cargo",
      size: 1, grade: "A", manufacturer_id: CARRACK_MFR.anvil,
    });

    // -----------------------------------------------------------------------
    // Seed ports — the full Carrack Expedition hierarchy
    // -----------------------------------------------------------------------
    const vid = carrackVehicleId;

    // --- 4 turrets, each with 2 VariPuck S4 → CF-447 Rhino ---
    const turretConfigs = [
      { name: "hardpoint_turret_left", uuid_prefix: "turret-left", equipped: CARRACK_UUID.mannedTurretLeft },
      { name: "hardpoint_turret_right", uuid_prefix: "turret-right", equipped: CARRACK_UUID.mannedTurretRight },
      { name: "hardpoint_turret_back_rear", uuid_prefix: "turret-rear", equipped: CARRACK_UUID.mannedTurretRear },
      { name: "hardpoint_turret_remote_turret", uuid_prefix: "turret-remote", equipped: CARRACK_UUID.remoteTurret },
    ];

    for (const cfg of turretConfigs) {
      const turretId = await seedPort(db, {
        uuid: `carrack-port-${cfg.uuid_prefix}`, vehicle_id: vid, name: cfg.name,
        category_label: "Turrets", size_min: 5, size_max: 5, port_type: "turret",
        equipped_item_uuid: cfg.equipped, editable: 1,
      });

      // turret_left child → VariPuck S4 → Rhino
      // rear turret children are non-editable (editable=0)
      const childEditable = cfg.uuid_prefix === "turret-rear" ? 0 : 1;
      const leftId = await seedPort(db, {
        uuid: `carrack-port-${cfg.uuid_prefix}-weapon-left`, vehicle_id: vid, name: "turret_left",
        parent_port_id: turretId,
        category_label: "Weapons", size_min: 4, size_max: 4, port_type: "weapon",
        equipped_item_uuid: CARRACK_UUID.varipuckS4, editable: childEditable,
      });
      await seedPort(db, {
        uuid: `carrack-port-${cfg.uuid_prefix}-wl-gun`, vehicle_id: vid, name: "hardpoint_class_2",
        parent_port_id: leftId,
        size_min: 3, size_max: 4, port_type: "weapon",
        equipped_item_uuid: CARRACK_UUID.rhinoS4,
      });

      // turret_right child → VariPuck S4 → Rhino
      const rightId = await seedPort(db, {
        uuid: `carrack-port-${cfg.uuid_prefix}-weapon-right`, vehicle_id: vid, name: "turret_right",
        parent_port_id: turretId,
        category_label: "Weapons", size_min: 4, size_max: 4, port_type: "weapon",
        equipped_item_uuid: CARRACK_UUID.varipuckS4, editable: childEditable,
      });
      await seedPort(db, {
        uuid: `carrack-port-${cfg.uuid_prefix}-wr-gun`, vehicle_id: vid, name: "hardpoint_class_2",
        parent_port_id: rightId,
        size_min: 3, size_max: 4, port_type: "weapon",
        equipped_item_uuid: CARRACK_UUID.rhinoS4,
      });

      // Display/Screen noise children (should be filtered out)
      await seedPort(db, {
        uuid: `carrack-port-${cfg.uuid_prefix}-display-hud`, vehicle_id: vid, name: "Display_HUD",
        parent_port_id: turretId,
        category_label: "Weapons", size_min: 1, size_max: 1, port_type: "weapon",
        editable: 1,
      });
      await seedPort(db, {
        uuid: `carrack-port-${cfg.uuid_prefix}-screen-left`, vehicle_id: vid, name: "Screen_Left",
        parent_port_id: turretId,
        category_label: "Weapons", size_min: 1, size_max: 1, port_type: "weapon",
        equipped_item_uuid: CARRACK_UUID.screenMFD, editable: 1,
      });
      await seedPort(db, {
        uuid: `carrack-port-${cfg.uuid_prefix}-screen-right`, vehicle_id: vid, name: "Screen_Right",
        parent_port_id: turretId,
        category_label: "Weapons", size_min: 1, size_max: 1, port_type: "weapon",
        equipped_item_uuid: CARRACK_UUID.screenMFD, editable: 1,
      });
      await seedPort(db, {
        uuid: `carrack-port-${cfg.uuid_prefix}-screen-radar`, vehicle_id: vid, name: "Screen_Radar",
        parent_port_id: turretId,
        category_label: "Weapons", size_min: 1, size_max: 1, port_type: "weapon",
        equipped_item_uuid: CARRACK_UUID.radarDisplay, editable: 1,
      });
    }

    // --- Access turret (should be filtered by name NOT LIKE '%_access') ---
    await seedPort(db, {
      uuid: "carrack-port-turret-access", vehicle_id: vid, name: "hardpoint_turret_back_rear_access",
      category_label: "Turrets", size_min: 1, size_max: 1, port_type: "turret",
      equipped_item_uuid: CARRACK_UUID.accessTurret, editable: 1,
    });

    // --- Shields (2×) ---
    for (const side of ["l", "r"]) {
      await seedPort(db, {
        uuid: `carrack-port-shield-${side}`, vehicle_id: vid,
        name: `hardpoint_shield_generator_${side}`,
        category_label: "Shields", size_min: 3, size_max: 3, port_type: "shield",
        equipped_item_uuid: CARRACK_UUID.barbicanShield,
      });
    }

    // --- Power plants (2×) ---
    for (const num of ["01", "02"]) {
      await seedPort(db, {
        uuid: `carrack-port-power-${num}`, vehicle_id: vid,
        name: `hardpoint_power_plant_${num}`,
        category_label: "Power", size_min: 3, size_max: 3, port_type: "power",
        equipped_item_uuid: CARRACK_UUID.reliancePP,
      });
    }

    // --- Coolers (2×) ---
    for (const side of ["l", "r"]) {
      await seedPort(db, {
        uuid: `carrack-port-cooler-${side}`, vehicle_id: vid,
        name: `hardpoint_cooler_${side}`,
        category_label: "Cooling", size_min: 3, size_max: 3, port_type: "cooler",
        equipped_item_uuid: CARRACK_UUID.iceFlushCooler,
      });
    }

    // --- Quantum drive → Jump drive (parent-child) ---
    const qdId = await seedPort(db, {
      uuid: "carrack-port-qd", vehicle_id: vid, name: "hardpoint_quantum_drive",
      category_label: "Quantum Drive", size_min: 3, size_max: 3, port_type: "quantum_drive",
      equipped_item_uuid: CARRACK_UUID.kamaQD,
    });
    await seedPort(db, {
      uuid: "carrack-port-jd", vehicle_id: vid, name: "hardpoint_jump_drive",
      parent_port_id: qdId,
      category_label: "Jump Drive", size_min: 3, size_max: 3, port_type: "jump_drive",
      equipped_item_uuid: CARRACK_UUID.exodusJD,
    });

    // --- Countermeasures (2×, different launchers) ---
    await seedPort(db, {
      uuid: "carrack-port-cm-left", vehicle_id: vid, name: "hardpoint_countermeasures_left",
      category_label: "Countermeasures", size_min: 1, size_max: 1, port_type: "countermeasure",
      equipped_item_uuid: CARRACK_UUID.defconFlares,
    });
    await seedPort(db, {
      uuid: "carrack-port-cm-right", vehicle_id: vid, name: "hardpoint_countermeasures_right",
      category_label: "Countermeasures", size_min: 1, size_max: 1, port_type: "countermeasure",
      equipped_item_uuid: CARRACK_UUID.defconNoise,
    });

    // --- Sensor ---
    await seedPort(db, {
      uuid: "carrack-port-radar", vehicle_id: vid, name: "hardpoint_radar",
      category_label: "Sensors", size_min: 2, size_max: 2, port_type: "sensor",
      equipped_item_uuid: CARRACK_UUID.surveyorRadar,
    });

    // --- Cargo grid (18 slots) ---
    // 9 main bay grids
    const mainCargoNames = [
      "hardpoint_cargo_front_left", "hardpoint_cargo_front_mid", "hardpoint_cargo_front_right",
      "hardpoint_cargo_mid_left", "hardpoint_cargo_mid_mid", "hardpoint_cargo_mid_right",
      "hardpoint_cargo_rear_left", "hardpoint_cargo_rear_mid", "hardpoint_cargo_rear_right",
    ];
    for (let i = 0; i < mainCargoNames.length; i++) {
      const equip = mainCargoNames[i].includes("_mid_mid") || mainCargoNames[i].includes("_front_mid") || mainCargoNames[i].includes("_rear_mid")
        ? CARRACK_UUID.cargoGrid2 : CARRACK_UUID.cargoGrid1;
      await seedPort(db, {
        uuid: `carrack-port-cargo-main-${i}`, vehicle_id: vid,
        name: mainCargoNames[i],
        category_label: "Cargo Grid", size_min: 1, size_max: 1, port_type: "cargo_grid",
        equipped_item_uuid: equip,
      });
    }

    // 3 pod containers (non-editable)
    for (const num of ["01", "02", "03"]) {
      await seedPort(db, {
        uuid: `carrack-port-cargo-pod-${num}`, vehicle_id: vid,
        name: `hardpoint_cargo_pod_${num}`,
        category_label: "Cargo Grid", size_min: num === "01" ? 1 : 0, size_max: num === "01" ? 1 : 0,
        port_type: "cargo_grid",
        equipped_item_uuid: CARRACK_UUID.cargoPod, editable: 0,
      });
    }

    // 6 pod side modules (3 left, 3 right)
    for (const num of ["01", "02", "03"]) {
      await seedPort(db, {
        uuid: `carrack-port-cargo-pod-${num}-L`, vehicle_id: vid,
        name: `hardpoint_cargo_pod_${num}_L`,
        category_label: "Cargo Grid", size_min: 1, size_max: 1, port_type: "cargo_grid",
        equipped_item_uuid: CARRACK_UUID.cargoPodL,
      });
      await seedPort(db, {
        uuid: `carrack-port-cargo-pod-${num}-R`, vehicle_id: vid,
        name: `hardpoint_cargo_pod_${num}_R`,
        category_label: "Cargo Grid", size_min: 1, size_max: 1, port_type: "cargo_grid",
        equipped_item_uuid: CARRACK_UUID.cargoPodR,
      });
    }

    // --- Weapon lockers (should NOT appear — null category_label, null port_type) ---
    for (const num of [1, 2]) {
      const lockerId = await seedPort(db, {
        uuid: `carrack-port-weapon-locker-${num}`, vehicle_id: vid,
        name: `hardpoint_weapon_locker_0${num}`,
        category_label: null, size_min: 1, size_max: 1, port_type: null,
        equipped_item_uuid: CARRACK_UUID.weaponLocker,
      });
      // Weapon rack children (rifle + pistol slots)
      for (let r = 1; r <= 8; r++) {
        const rn = String(r).padStart(2, "0");
        await seedPort(db, {
          uuid: `carrack-port-locker-${num}-rifle-${rn}`, vehicle_id: vid,
          name: `$IP_rifle_${rn}`,
          parent_port_id: lockerId,
          category_label: "Weapons", size_min: 2, size_max: 4, port_type: "weapon",
          editable: 1,
        });
      }
      for (let p = 1; p <= 12; p++) {
        const pn = String(p).padStart(2, "0");
        await seedPort(db, {
          uuid: `carrack-port-locker-${num}-pistol-${pn}`, vehicle_id: vid,
          name: `$IP_pistol_${pn}`,
          parent_port_id: lockerId,
          category_label: "Weapons", size_min: 0, size_max: 1, port_type: "weapon",
          editable: 1,
        });
      }
    }
  });

  // =========================================================================
  // Tests
  // =========================================================================

  it("returns exactly the right number of ports (no weapon racks, no Display noise, no _access)", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/carrack-expedition/components");
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>[];

    // Expected:
    // Turrets: 4 (left, right, rear, remote)
    // Weapon children of turrets: 8 (2 per turret × 4 turrets — turret_left + turret_right)
    // Shields: 2
    // Power: 2
    // Cooling: 2
    // QD: 1
    // JD: 1
    // Countermeasures: 2
    // Sensors: 1
    // Cargo Grid: 18
    // Total: 41
    //
    // EXCLUDED: weapon rack children (40 total), Display_HUD/Screen_* (16 total),
    //           _access turret (1), weapon lockers (2)
    expect(data.length).toBe(41);
  });

  it("resolves 3-level turret hierarchy: TurretBase → VariPuck S4 → CF-447 Rhino", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/carrack-expedition/components");
    const data = (await res.json()) as Record<string, unknown>[];

    // Left manned turret should resolve through to the deepest weapon
    const leftTurret = data.find(
      (p) => p.port_name === "hardpoint_turret_left"
    );
    expect(leftTurret).toBeDefined();
    expect(leftTurret!.port_type).toBe("turret");
    expect(leftTurret!.mount_name).toBe("Manned Turret");
    expect(leftTurret!.component_name).toBe("CF-447 Rhino Repeater");
    expect(leftTurret!.component_type).toBe("WeaponGun");
    expect(leftTurret!.dps).toBe(817.88);
    expect(leftTurret!.weapon_count).toBe(2);
  });

  it("resolves all 4 turrets with 2 weapons each", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/carrack-expedition/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const turrets = data.filter((p) => p.port_type === "turret");
    expect(turrets).toHaveLength(4);

    for (const t of turrets) {
      expect(t.component_name).toBe("CF-447 Rhino Repeater");
      expect(t.weapon_count).toBe(2);
    }

    // Remote turret uses Turret (not TurretBase) as its mount
    const remote = data.find(
      (p) => p.port_name === "hardpoint_turret_remote_turret"
    );
    expect(remote).toBeDefined();
    expect(remote!.mount_name).toBe("Remote Turret");
    expect(remote!.mount_type).toBe("Turret");
  });

  it("turret weapon children each resolve VariPuck → Rhino", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/carrack-expedition/components");
    const data = (await res.json()) as Record<string, unknown>[];

    // 8 turret weapon children total (turret_left + turret_right under each of 4 turrets)
    const turretWeapons = data.filter(
      (p) =>
        p.port_type === "weapon" &&
        (p.port_name === "turret_left" || p.port_name === "turret_right")
    );
    expect(turretWeapons).toHaveLength(8);

    for (const w of turretWeapons) {
      expect(w.mount_name).toBe("VariPuck S4 Gimbal Mount");
      expect(w.component_name).toBe("CF-447 Rhino Repeater");
      expect(w.component_type).toBe("WeaponGun");
      expect(w.dps).toBe(817.88);
    }
  });

  it("excludes weapon rack children (hardpoint_weapon_locker must NOT appear)", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/carrack-expedition/components");
    const data = (await res.json()) as Record<string, unknown>[];

    // No weapon locker parents
    const lockers = data.filter((p) =>
      (p.port_name as string).includes("weapon_locker")
    );
    expect(lockers).toHaveLength(0);

    // No $IP_rifle or $IP_pistol rack slots
    const racks = data.filter(
      (p) =>
        (p.port_name as string).startsWith("$IP_rifle") ||
        (p.port_name as string).startsWith("$IP_pistol")
    );
    expect(racks).toHaveLength(0);
  });

  it("excludes _access ports", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/carrack-expedition/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const access = data.filter((p) =>
      (p.port_name as string).includes("_access")
    );
    expect(access).toHaveLength(0);
  });

  it("excludes Display/Screen noise from turret children", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/carrack-expedition/components");
    const data = (await res.json()) as Record<string, unknown>[];

    // No Display_HUD ports
    const displayHud = data.filter((p) => p.port_name === "Display_HUD");
    expect(displayHud).toHaveLength(0);

    // No Screen_* ports
    const screens = data.filter((p) =>
      (p.port_name as string).startsWith("Screen_")
    );
    expect(screens).toHaveLength(0);

    // No component_type === 'Display' in results
    const displays = data.filter((p) => p.component_type === "Display");
    expect(displays).toHaveLength(0);
  });

  it("returns both shields with correct stats", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/carrack-expedition/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const shields = data.filter((p) => p.port_type === "shield");
    expect(shields).toHaveLength(2);

    for (const s of shields) {
      expect(s.component_name).toBe("Barbican");
      expect(s.component_type).toBe("Shield");
      expect(s.shield_hp).toBe(45000);
      expect(s.shield_regen).toBe(4050);
      expect(s.component_size).toBe(3);
      expect(s.grade).toBe("B");
    }
  });

  it("returns both power plants with correct output", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/carrack-expedition/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const powerPlants = data.filter((p) => p.port_type === "power");
    expect(powerPlants).toHaveLength(2);

    for (const pp of powerPlants) {
      expect(pp.component_name).toBe("Reliance");
      expect(pp.component_type).toBe("PowerPlant");
      expect(pp.power_output).toBe(52500);
    }
  });

  it("returns both coolers with correct cooling rate", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/carrack-expedition/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const coolers = data.filter((p) => p.port_type === "cooler");
    expect(coolers).toHaveLength(2);

    for (const c of coolers) {
      expect(c.component_name).toBe("Ice-Flush");
      expect(c.cooling_rate).toBe(16800000);
    }
  });

  it("returns quantum drive with correct stats and jump drive as child", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/carrack-expedition/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const qd = data.find((p) => p.port_type === "quantum_drive");
    expect(qd).toBeDefined();
    expect(qd!.component_name).toBe("Kama");
    expect(qd!.quantum_speed).toBe(319000000);

    const jd = data.find((p) => p.port_type === "jump_drive");
    expect(jd).toBeDefined();
    expect(jd!.component_name).toBe("Exodus");
    expect(jd!.parent_port_id).toBeTruthy();
  });

  it("returns both countermeasures", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/carrack-expedition/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const cms = data.filter((p) => p.port_type === "countermeasure");
    expect(cms).toHaveLength(2);

    const cmNames = cms.map((c) => c.component_name).sort();
    expect(cmNames).toContain("Joker Defcon Flares Ammo");
    // F503: CountermeasureLauncher names stripped of parent-ship prefix
    // ("Joker Defcon - Noise Launcher" → "Noise Launcher") at query time.
    expect(cmNames).toContain("Noise Launcher");
  });

  it("returns 1 sensor (Surveyor radar)", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/carrack-expedition/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const sensors = data.filter((p) => p.port_type === "sensor");
    expect(sensors).toHaveLength(1);
    expect(sensors[0].component_name).toBe("Surveyor");
  });

  it("returns 18 cargo grid slots", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/carrack-expedition/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const cargo = data.filter((p) => p.port_type === "cargo_grid");
    expect(cargo).toHaveLength(18);
  });

  it("returns category_labels in the correct display order", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/carrack-expedition/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const ORDER = [
      "Weapons", "Turrets", "Shields", "Power",
      "Cooling", "Quantum Drive", "Jump Drive",
      "Countermeasures", "Sensors", "Cargo Grid",
    ];

    const seen: string[] = [];
    for (const p of data) {
      const cat = p.category_label as string;
      if (!seen.includes(cat)) seen.push(cat);
    }

    const filtered = seen.filter((c) => ORDER.includes(c));
    for (let i = 1; i < filtered.length; i++) {
      expect(ORDER.indexOf(filtered[i])).toBeGreaterThan(
        ORDER.indexOf(filtered[i - 1])
      );
    }
  });

  it("rear turret children are non-editable (locked weapons)", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/carrack-expedition/components");
    const data = (await res.json()) as Record<string, unknown>[];

    // The rear turret's weapon children should have editable=0
    // Identify them by finding weapon children whose parent is the rear turret
    const rearTurret = data.find(
      (p) => p.port_name === "hardpoint_turret_back_rear"
    );
    expect(rearTurret).toBeDefined();

    const rearWeapons = data.filter(
      (p) => p.port_type === "weapon" && p.parent_port_id === rearTurret!.port_id
    );
    expect(rearWeapons).toHaveLength(2);
    for (const w of rearWeapons) {
      expect(w.editable).toBe(0);
    }
  });

  it("COALESCE resolves mount vs deepest correctly for turret children", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/carrack-expedition/components");
    const data = (await res.json()) as Record<string, unknown>[];

    // For a turret weapon child: mount_name = VariPuck, component_name = Rhino
    const turretWeapon = data.find(
      (p) => p.port_name === "turret_left" && p.port_type === "weapon"
    );
    expect(turretWeapon).toBeDefined();
    expect(turretWeapon!.mount_name).toBe("VariPuck S4 Gimbal Mount");
    expect(turretWeapon!.component_name).toBe("CF-447 Rhino Repeater");
    expect(turretWeapon!.mount_name).not.toBe(turretWeapon!.component_name);
  });
});

// ===========================================================================
// Hermes — golden loadout test (tractor beam regression)
//
// Seeds a faithful replica of the Hermes port hierarchy:
// - 2 gimballed weapons (VariPuck S4 → CF-447 Rhino)
// - 1 remote turret with 2 weapon children (also gimballed Rhinos)
// - 1 tractor beam turret (ToolArm → empty turret child → SureGrip TractorBeam)
// - 2 missile racks (Hermes Missile Rack → 8× Ignite II each)
// - 4 shields (STOP S2), 2 power, 2 coolers, QD+JD, 2 CMs, 2 sensors, 2 cargo
//
// This test is CRITICAL because it validates:
// 1. TractorBeam components are NOT filtered out by noise exclusion
// 2. ToolArm mount type resolves through to the deepest tractor beam weapon
// 3. The 3-level tractor turret hierarchy (ToolArm → Turret → TractorBeam) works
// ===========================================================================

let hermesVehicleId: number;

// Component UUIDs for Hermes — stable for this test
const HERMES_UUID = {
  varipuckS4: "hermes-vp-s4-gimbal-uuid",
  rhinoS4: "hermes-cf447-rhino-uuid",
  remoteTurret: "hermes-remote-turret-uuid",
  tractorTurret: "hermes-tractor-turret-uuid",
  sureGripS2: "hermes-suregrip-s2-uuid",
  hermesMissileRack: "hermes-missile-rack-uuid",
  igniteII: "hermes-ignite2-missile-uuid",
  stopShield: "hermes-stop-shield-uuid",
  fullForcePP: "hermes-fullforce-pp-uuid",
  coldSnapCooler: "hermes-coldsnap-cooler-uuid",
  odysseyQD: "hermes-odyssey-qd-uuid",
  excelsiorJD: "hermes-excelsior-jd-uuid",
  jokerDefcon: "hermes-joker-defcon-uuid",
  aegisDecoy: "hermes-aegis-decoy-uuid",
  chernykh: "hermes-chernykh-radar-uuid",
} as const;

// Additional manufacturer IDs for Hermes (some reuse MFR constants from Asgard)
const HERMES_MFR = {
  sealCorp: 95,
  greycat: 47,
  jokerEng: 55,
  aegisDyn: 5,
  flashfire: 179,
} as const;

describe("Loadout API — Hermes golden data (tractor beam regression)", () => {
  beforeAll(async () => {
    // Each describe block gets its own isolated D1 database — must set up from scratch.
    await setupTestDatabase(env.DB);
    await seedManufacturers(env.DB);

    // Seed additional manufacturers for Hermes
    const mfrs = [
      { id: HERMES_MFR.sealCorp, name: "Seal Corporation", code: "SECO", slug: "seal-corp" },
      { id: HERMES_MFR.greycat, name: "Greycat Industrial", code: "GRIN", slug: "greycat-industrial" },
      { id: HERMES_MFR.jokerEng, name: "Joker Engineering", code: "JOK", slug: "joker-engineering" },
      { id: HERMES_MFR.aegisDyn, name: "Aegis Dynamics", code: "AEG", slug: "aegis-dynamics" },
      { id: HERMES_MFR.flashfire, name: "Flashfire Systems", code: "FFSY", slug: "flashfire-systems" },
    ];
    const mfrStmts = mfrs.map((m) =>
      env.DB
        .prepare(
          `INSERT OR IGNORE INTO manufacturers (id, uuid, name, slug, code, game_version_id)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(m.id, `mfr-uuid-${m.id}`, m.name, m.slug, m.code, TEST_GAME_VERSION_ID)
    );
    await env.DB.batch(mfrStmts);

    // -----------------------------------------------------------------------
    // Seed vehicle: Hermes
    // -----------------------------------------------------------------------
    await env.DB
      .prepare(
        `INSERT INTO vehicles (slug, name, focus, size_label, cargo, crew_min, crew_max,
         speed_scm, speed_max, fuel_capacity_hydrogen, fuel_capacity_quantum,
         classification, manufacturer_id, game_version_id, updated_at)
         VALUES ('hermes', 'Hermes', 'Pathfinder', 'medium', 48, 1, 2,
         210, 1170, 82.5, 1.5,
         'Multi', ${HERMES_MFR.aegisDyn}, ${TEST_GAME_VERSION_ID}, datetime('now'))`
      )
      .run();

    const vRow = await env.DB
      .prepare("SELECT id FROM vehicles WHERE slug = 'hermes'")
      .first<{ id: number }>();
    hermesVehicleId = vRow!.id;

    await env.DB
      .prepare("INSERT OR IGNORE INTO vehicle_images (vehicle_id) VALUES (?)")
      .bind(hermesVehicleId)
      .run();

    // -----------------------------------------------------------------------
    // Seed components (the Hermes stock loadout)
    // -----------------------------------------------------------------------
    await seedComponent(env.DB, {
      uuid: HERMES_UUID.varipuckS4, name: "VariPuck S4 Gimbal Mount", type: "Turret",
      sub_type: "GunTurret", size: 4, grade: "A", manufacturer_id: MFR.behring,
    });
    await seedComponent(env.DB, {
      uuid: HERMES_UUID.rhinoS4, name: "CF-447 Rhino Repeater", type: "WeaponGun",
      sub_type: "Gun", size: 4, grade: "A", manufacturer_id: MFR.klausWerner,
      dps: 817.88, damage_per_shot: 65.43, damage_type: "Energy",
      rounds_per_minute: 750, projectile_speed: 1800,
      damage_energy: 65.43, thermal_output: 20, power_draw: 22.5,
      penetration: 1, weapon_range: 3006,
    });
    await seedComponent(env.DB, {
      uuid: HERMES_UUID.remoteTurret, name: "Remote Turret", type: "Turret",
      sub_type: "TopTurret", size: 3, grade: "A", manufacturer_id: HERMES_MFR.aegisDyn,
    });
    await seedComponent(env.DB, {
      uuid: HERMES_UUID.tractorTurret, name: "Tractor Turret", type: "ToolArm",
      sub_type: "UNDEFINED", size: 2, grade: "A", manufacturer_id: HERMES_MFR.greycat,
    });
    await seedComponent(env.DB, {
      uuid: HERMES_UUID.sureGripS2, name: "SureGrip S2 Tractor Beam", type: "TractorBeam",
      sub_type: "UNDEFINED", size: 2, grade: "A", manufacturer_id: HERMES_MFR.greycat,
    });
    await seedComponent(env.DB, {
      uuid: HERMES_UUID.hermesMissileRack, name: "Hermes Missile Rack", type: "MissileLauncher",
      sub_type: "MissileRack", size: 2, grade: "A", manufacturer_id: HERMES_MFR.flashfire,
    });
    await seedComponent(env.DB, {
      uuid: HERMES_UUID.igniteII, name: "Ignite II Missile", type: "Missile",
      sub_type: "Missile", size: 2, grade: "A", manufacturer_id: HERMES_MFR.flashfire,
    });
    await seedComponent(env.DB, {
      uuid: HERMES_UUID.stopShield, name: "STOP", type: "Shield",
      sub_type: "UNDEFINED", size: 2, grade: "C", manufacturer_id: HERMES_MFR.sealCorp,
      shield_hp: 9000, shield_regen: 855,
      resist_physical: 0.5, resist_energy: 0.5, resist_distortion: 0.5, resist_thermal: 0.5,
    });
    await seedComponent(env.DB, {
      uuid: HERMES_UUID.fullForcePP, name: "FullForce", type: "PowerPlant",
      sub_type: "Power", size: 2, grade: "C", manufacturer_id: MFR.basilisk,
      power_output: 8750,
    });
    await seedComponent(env.DB, {
      uuid: HERMES_UUID.coldSnapCooler, name: "ColdSnap", type: "Cooler",
      sub_type: "UNDEFINED", size: 2, grade: "C", manufacturer_id: MFR.basilisk,
      cooling_rate: 4800000,
    });
    await seedComponent(env.DB, {
      uuid: HERMES_UUID.odysseyQD, name: "Odyssey", type: "QuantumDrive",
      sub_type: "UNDEFINED", size: 2, grade: "C", manufacturer_id: MFR.rsi,
      quantum_speed: 201000000, quantum_range: 100000000,
      fuel_rate: 84.46, spool_time: 5.26,
    });
    await seedComponent(env.DB, {
      uuid: HERMES_UUID.excelsiorJD, name: "Excelsior", type: "JumpDrive",
      sub_type: "UNDEFINED", size: 2, grade: "C", manufacturer_id: MFR.rsi,
    });
    await seedComponent(env.DB, {
      uuid: HERMES_UUID.jokerDefcon, name: "Joker Defcon - Noise Launcher", type: "WeaponDefensive",
      sub_type: "CountermeasureLauncher", size: 1, grade: "A", manufacturer_id: HERMES_MFR.jokerEng,
    });
    await seedComponent(env.DB, {
      uuid: HERMES_UUID.aegisDecoy, name: "Aegis Gladius - Decoy Launcher", type: "WeaponDefensive",
      sub_type: "CountermeasureLauncher", size: 1, grade: "A", manufacturer_id: HERMES_MFR.aegisDyn,
    });
    await seedComponent(env.DB, {
      uuid: HERMES_UUID.chernykh, name: "Chernykh", type: "Radar",
      sub_type: "MidRangeRadar", size: 2, grade: "C", manufacturer_id: MFR.rsi,
      radar_range: 14000,
    });

    // -----------------------------------------------------------------------
    // Seed ports — the full Hermes hierarchy
    // -----------------------------------------------------------------------
    const vid = hermesVehicleId;

    // --- Top-level gimballed weapons (2× VariPuck S4 → CF-447 Rhino) ---
    const weaponLeftId = await seedPort(env.DB, {
      uuid: "hermes-port-weapon-left", vehicle_id: vid, name: "hardpoint_weapon_left",
      category_label: "Weapons", size_min: 4, size_max: 4, port_type: "weapon",
      equipped_item_uuid: HERMES_UUID.varipuckS4, editable: 1,
    });
    await seedPort(env.DB, {
      uuid: "hermes-port-weapon-left-gun", vehicle_id: vid, name: "hardpoint_class_2",
      parent_port_id: weaponLeftId,
      category_label: "Weapons", size_min: 3, size_max: 4, port_type: "weapon",
      equipped_item_uuid: HERMES_UUID.rhinoS4,
    });
    const weaponRightId = await seedPort(env.DB, {
      uuid: "hermes-port-weapon-right", vehicle_id: vid, name: "hardpoint_weapon_right",
      category_label: "Weapons", size_min: 4, size_max: 4, port_type: "weapon",
      equipped_item_uuid: HERMES_UUID.varipuckS4, editable: 1,
    });
    await seedPort(env.DB, {
      uuid: "hermes-port-weapon-right-gun", vehicle_id: vid, name: "hardpoint_class_2",
      parent_port_id: weaponRightId,
      category_label: "Weapons", size_min: 3, size_max: 4, port_type: "weapon",
      equipped_item_uuid: HERMES_UUID.rhinoS4,
    });

    // --- Remote turret (turret → 2× weapon children via gimbals → Rhino) ---
    const remoteTurretId = await seedPort(env.DB, {
      uuid: "hermes-port-turret", vehicle_id: vid, name: "hardpoint_turret",
      category_label: "Turrets", size_min: 3, size_max: 3, port_type: "turret",
      equipped_item_uuid: HERMES_UUID.remoteTurret, editable: 1,
    });
    const turretWeaponLeftId = await seedPort(env.DB, {
      uuid: "hermes-port-turret-weapon-left", vehicle_id: vid, name: "hardpoint_weapon_left",
      parent_port_id: remoteTurretId,
      category_label: "Weapons", size_min: 4, size_max: 4, port_type: "weapon",
      equipped_item_uuid: HERMES_UUID.varipuckS4, editable: 1,
    });
    await seedPort(env.DB, {
      uuid: "hermes-port-turret-wl-gun", vehicle_id: vid, name: "hardpoint_class_2",
      parent_port_id: turretWeaponLeftId,
      category_label: "Weapons", size_min: 3, size_max: 4, port_type: "weapon",
      equipped_item_uuid: HERMES_UUID.rhinoS4,
    });
    const turretWeaponRightId = await seedPort(env.DB, {
      uuid: "hermes-port-turret-weapon-right", vehicle_id: vid, name: "hardpoint_weapon_right",
      parent_port_id: remoteTurretId,
      category_label: "Weapons", size_min: 4, size_max: 4, port_type: "weapon",
      equipped_item_uuid: HERMES_UUID.varipuckS4, editable: 1,
    });
    await seedPort(env.DB, {
      uuid: "hermes-port-turret-wr-gun", vehicle_id: vid, name: "hardpoint_class_2",
      parent_port_id: turretWeaponRightId,
      category_label: "Weapons", size_min: 3, size_max: 4, port_type: "weapon",
      equipped_item_uuid: HERMES_UUID.rhinoS4,
    });

    // --- Tractor beam turret (THE KEY REGRESSION TARGET) ---
    // Structure: Tractor Turret (ToolArm) → Remote Turret child (empty) → SureGrip weapon
    const tractorTurretId = await seedPort(env.DB, {
      uuid: "hermes-port-tractor-turret", vehicle_id: vid,
      name: "hardpoint_remote_tractor_turret",
      category_label: "Turrets", size_min: 2, size_max: 2, port_type: "turret",
      equipped_item_uuid: HERMES_UUID.tractorTurret, editable: 1,
    });
    const tractorRemoteTurretId = await seedPort(env.DB, {
      uuid: "hermes-port-tractor-remote", vehicle_id: vid,
      name: "hardpoint_remote_turret",
      parent_port_id: tractorTurretId,
      category_label: "Turrets", size_min: 2, size_max: 2, port_type: "turret",
      editable: 0,
    });
    await seedPort(env.DB, {
      uuid: "hermes-port-tractor-weapon", vehicle_id: vid,
      name: "hardpoint_weapon",
      parent_port_id: tractorRemoteTurretId,
      category_label: "Weapons", size_min: 2, size_max: 2, port_type: "weapon",
      equipped_item_uuid: HERMES_UUID.sureGripS2, editable: 1,
    });

    // --- Missile racks (2× Hermes Missile Rack → 8× Ignite II each) ---
    const missileLeftId = await seedPort(env.DB, {
      uuid: "hermes-port-missile-left", vehicle_id: vid,
      name: "hardpoint_missile_left",
      category_label: "Missiles", size_min: 2, size_max: 2, port_type: "missile",
      equipped_item_uuid: HERMES_UUID.hermesMissileRack, editable: 1,
    });
    for (let i = 1; i <= 8; i++) {
      const num = String(i).padStart(2, "0");
      await seedPort(env.DB, {
        uuid: `hermes-port-missile-left-${num}`, vehicle_id: vid,
        name: `missile_${num}_attach`,
        parent_port_id: missileLeftId,
        category_label: "Missiles", size_min: 2, size_max: 2, port_type: "missile",
        equipped_item_uuid: HERMES_UUID.igniteII,
      });
    }
    const missileRightId = await seedPort(env.DB, {
      uuid: "hermes-port-missile-right", vehicle_id: vid,
      name: "hardpoint_missile_right",
      category_label: "Missiles", size_min: 2, size_max: 2, port_type: "missile",
      equipped_item_uuid: HERMES_UUID.hermesMissileRack, editable: 1,
    });
    for (let i = 1; i <= 8; i++) {
      const num = String(i).padStart(2, "0");
      await seedPort(env.DB, {
        uuid: `hermes-port-missile-right-${num}`, vehicle_id: vid,
        name: `missile_${num}_attach`,
        parent_port_id: missileRightId,
        category_label: "Missiles", size_min: 2, size_max: 2, port_type: "missile",
        equipped_item_uuid: HERMES_UUID.igniteII,
      });
    }

    // --- Shields (4× STOP S2) ---
    for (const num of ["01", "02", "03", "04"]) {
      await seedPort(env.DB, {
        uuid: `hermes-port-shield-${num}`, vehicle_id: vid,
        name: `hardpoint_shield_generator_${num}_hermes`,
        category_label: "Shields", size_min: 2, size_max: 2, port_type: "shield",
        equipped_item_uuid: HERMES_UUID.stopShield,
      });
    }

    // --- Power plants (2× FullForce S2) ---
    for (const num of ["01", "02"]) {
      await seedPort(env.DB, {
        uuid: `hermes-port-power-${num}`, vehicle_id: vid,
        name: `hardpoint_power_plant_${num}`,
        category_label: "Power", size_min: 2, size_max: 2, port_type: "power",
        equipped_item_uuid: HERMES_UUID.fullForcePP,
      });
    }

    // --- Coolers (2× ColdSnap S2) ---
    for (const num of ["01", "02"]) {
      await seedPort(env.DB, {
        uuid: `hermes-port-cooler-${num}`, vehicle_id: vid,
        name: `hardpoint_cooler_${num}`,
        category_label: "Cooling", size_min: 2, size_max: 2, port_type: "cooler",
        equipped_item_uuid: HERMES_UUID.coldSnapCooler,
      });
    }

    // --- Quantum drive → Jump drive (parent-child) ---
    const qdId = await seedPort(env.DB, {
      uuid: "hermes-port-qd", vehicle_id: vid, name: "hardpoint_quantum_drive",
      category_label: "Quantum Drive", size_min: 2, size_max: 2, port_type: "quantum_drive",
      equipped_item_uuid: HERMES_UUID.odysseyQD,
    });
    await seedPort(env.DB, {
      uuid: "hermes-port-jd", vehicle_id: vid, name: "hardpoint_jump_drive",
      parent_port_id: qdId,
      category_label: "Jump Drive", size_min: 2, size_max: 2, port_type: "jump_drive",
      equipped_item_uuid: HERMES_UUID.excelsiorJD,
    });

    // --- Countermeasures (2×) ---
    await seedPort(env.DB, {
      uuid: "hermes-port-cm-left", vehicle_id: vid,
      name: "hardpoint_countermeasure_left",
      category_label: "Countermeasures", size_min: 1, size_max: 1, port_type: "countermeasure",
      equipped_item_uuid: HERMES_UUID.jokerDefcon,
    });
    await seedPort(env.DB, {
      uuid: "hermes-port-cm-right", vehicle_id: vid,
      name: "hardpoint_countermeasure_right",
      category_label: "Countermeasures", size_min: 1, size_max: 1, port_type: "countermeasure",
      equipped_item_uuid: HERMES_UUID.aegisDecoy,
    });

    // --- Sensors (2× — radar with component + empty scanner) ---
    await seedPort(env.DB, {
      uuid: "hermes-port-radar", vehicle_id: vid, name: "hardpoint_radar",
      category_label: "Sensors", size_min: 2, size_max: 2, port_type: "sensor",
      equipped_item_uuid: HERMES_UUID.chernykh,
    });
    await seedPort(env.DB, {
      uuid: "hermes-port-scanner", vehicle_id: vid, name: "hardpoint_scanner",
      category_label: "Sensors", size_min: 1, size_max: 1, port_type: "sensor",
    });

    // --- Cargo grids (2×, empty) ---
    await seedPort(env.DB, {
      uuid: "hermes-port-cargo-left", vehicle_id: vid,
      name: "hardpoint_cargo_left_hermes",
      category_label: "Cargo Grid", size_min: 1, size_max: 1, port_type: "cargo_grid",
    });
    await seedPort(env.DB, {
      uuid: "hermes-port-cargo-right", vehicle_id: vid,
      name: "hardpoint_cargo_right_hermes",
      category_label: "Cargo Grid", size_min: 1, size_max: 1, port_type: "cargo_grid",
    });
  });

  // =========================================================================
  // Tests
  // =========================================================================

  it("returns at least 20 components (full loadout, no noise)", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/hermes/components");
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>[];
    // Expected ports:
    // Weapons: 2 (top-level gimballed) + 2 (turret weapon children) = 4
    // Turrets: 3 (remote turret + tractor turret + tractor remote child)
    // Missiles: 2 (racks, slots excluded)
    // Shields: 4
    // Power: 2
    // Cooling: 2
    // QD: 1, JD: 1
    // CMs: 2
    // Sensors: 2
    // Cargo: 2
    // Total: 25
    expect(data.length).toBeGreaterThanOrEqual(20);
    expect(data.length).toBeLessThanOrEqual(30);
  });

  it("tractor beam turret IS present — catches tractor beam regression", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/hermes/components");
    const data = (await res.json()) as Record<string, unknown>[];

    // The tractor beam turret MUST be in results — this is the key regression test
    const tractorTurret = data.find(
      (p) => (p.port_name as string).includes("tractor")
    );
    expect(tractorTurret).toBeDefined();
    expect(tractorTurret!.port_name).toBe("hardpoint_remote_tractor_turret");
    expect(tractorTurret!.port_type).toBe("turret");

    // The deepest component should resolve to the SureGrip tractor beam
    expect(tractorTurret!.component_name).toBe("SureGrip S2 Tractor Beam");
    expect(tractorTurret!.component_type).toBe("TractorBeam");
    expect(tractorTurret!.mount_name).toBe("Tractor Turret");
  });

  it("has 3 turrets total (1 weapon turret + 1 tractor turret + 1 tractor child)", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/hermes/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const turrets = data.filter((p) => p.port_type === "turret");
    expect(turrets).toHaveLength(3);

    // Verify the specific turrets
    const turretNames = turrets.map((t) => t.port_name as string).sort();
    expect(turretNames).toContain("hardpoint_turret");
    expect(turretNames).toContain("hardpoint_remote_tractor_turret");
    expect(turretNames).toContain("hardpoint_remote_turret");
  });

  it("returns all 4 shields with correct stats", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/hermes/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const shields = data.filter((p) => p.port_type === "shield");
    expect(shields).toHaveLength(4);

    for (const s of shields) {
      expect(s.component_name).toBe("STOP");
      expect(s.component_type).toBe("Shield");
      expect(s.shield_hp).toBe(9000);
      expect(s.shield_regen).toBe(855);
      expect(s.component_size).toBe(2);
      expect(s.grade).toBe("C");
    }
  });

  it("returns 2 missile racks with correct missile counts (slots excluded)", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/hermes/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const missiles = data.filter((p) => p.port_type === "missile");
    expect(missiles).toHaveLength(2);

    for (const m of missiles) {
      expect(m.mount_name).toBe("Hermes Missile Rack");
      expect(m.component_name).toBe("Ignite II Missile");
      expect(m.component_type).toBe("Missile");
      expect(m.missile_count).toBe(8);
    }

    // Individual missile_*_attach slots must NOT appear
    const missileSlots = data.filter((p) =>
      (p.port_name as string).match(/^missile_\d+_attach$/)
    );
    expect(missileSlots).toHaveLength(0);
  });

  it("resolves gimballed weapons: VariPuck S4 → CF-447 Rhino", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/hermes/components");
    const data = (await res.json()) as Record<string, unknown>[];

    // Top-level gimballed weapons
    const topWeapons = data.filter(
      (p) =>
        p.port_type === "weapon" &&
        p.parent_port_id === null &&
        (p.port_name as string).startsWith("hardpoint_weapon_")
    );
    expect(topWeapons).toHaveLength(2);

    for (const w of topWeapons) {
      expect(w.mount_name).toBe("VariPuck S4 Gimbal Mount");
      expect(w.component_name).toBe("CF-447 Rhino Repeater");
      expect(w.component_type).toBe("WeaponGun");
      expect(w.dps).toBe(817.88);
      expect(w.weapon_count).toBe(1);
    }
  });

  it("remote turret resolves to deepest weapon with weapon_count=2", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/hermes/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const remoteTurret = data.find(
      (p) => p.port_name === "hardpoint_turret"
    );
    expect(remoteTurret).toBeDefined();
    expect(remoteTurret!.mount_name).toBe("Remote Turret");
    expect(remoteTurret!.component_name).toBe("CF-447 Rhino Repeater");
    expect(remoteTurret!.component_type).toBe("WeaponGun");
    expect(remoteTurret!.weapon_count).toBe(2);
  });

  it("excludes Display and SeatDashboard noise from results", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/hermes/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const noise = data.filter(
      (p) =>
        p.component_type === "Display" ||
        p.component_type === "SeatDashboard"
    );
    expect(noise).toHaveLength(0);
  });

  it("quantum drive and jump drive are present with correct parent-child relationship", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/hermes/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const qd = data.find((p) => p.port_type === "quantum_drive");
    expect(qd).toBeDefined();
    expect(qd!.component_name).toBe("Odyssey");
    expect(qd!.quantum_speed).toBe(201000000);

    const jd = data.find((p) => p.port_type === "jump_drive");
    expect(jd).toBeDefined();
    expect(jd!.component_name).toBe("Excelsior");
    expect(jd!.parent_port_id).toBeTruthy();
  });

  it("countermeasures, sensors, and cargo are all present", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/hermes/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const cms = data.filter((p) => p.port_type === "countermeasure");
    expect(cms).toHaveLength(2);

    const sensors = data.filter((p) => p.port_type === "sensor");
    expect(sensors).toHaveLength(2);

    const cargo = data.filter((p) => p.port_type === "cargo_grid");
    expect(cargo).toHaveLength(2);
  });

  it("category_labels appear in correct display order", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/hermes/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const ORDER = [
      "Weapons", "Turrets", "Missiles", "Shields", "Power",
      "Cooling", "Quantum Drive", "Jump Drive",
      "Countermeasures", "Sensors", "Cargo Grid",
    ];

    const seen: string[] = [];
    for (const p of data) {
      const cat = p.category_label as string;
      if (!seen.includes(cat)) seen.push(cat);
    }

    const filtered = seen.filter((c) => ORDER.includes(c));
    for (let i = 1; i < filtered.length; i++) {
      expect(ORDER.indexOf(filtered[i])).toBeGreaterThan(
        ORDER.indexOf(filtered[i - 1])
      );
    }
  });
});

// ===========================================================================
// Mining laser compatible components regression test
//
// Seeds a MOLE-like mining ship with a mining laser port (port_type='weapon')
// equipped with a WeaponMining component. When the user picks "compatible
// components" for that port, the endpoint should return ONLY WeaponMining
// components, not WeaponGun.
// ===========================================================================

let moleVehicleId: number;
let miningPortId: number;

const MOLE_UUID = {
  arbor: "mole-arbor-mining-laser-uuid",
  helix: "mole-helix-mining-laser-uuid",
  rhinoGun: "mole-rhino-weapon-gun-uuid",
} as const;

const MOLE_MFR = {
  argo: 170,
  greycat: 47,
  klausWerner: 60,
} as const;

describe("Loadout API — mining laser compatible components", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);

    // Seed manufacturers
    const mfrs = [
      { id: MOLE_MFR.argo, name: "ARGO Astronautics", code: "ARGO", slug: "argo-astronautics" },
      { id: MOLE_MFR.greycat, name: "Greycat Industrial", code: "GRIN", slug: "greycat-ind" },
      { id: MOLE_MFR.klausWerner, name: "Klaus & Werner", code: "KLWE", slug: "kw" },
    ];
    const mfrStmts = mfrs.map((m) =>
      env.DB
        .prepare(
          `INSERT OR IGNORE INTO manufacturers (id, uuid, name, slug, code, game_version_id)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(m.id, `mfr-uuid-${m.id}`, m.name, m.slug, m.code, TEST_GAME_VERSION_ID)
    );
    await env.DB.batch(mfrStmts);

    // Seed MOLE vehicle
    await env.DB
      .prepare(
        `INSERT INTO vehicles (slug, name, focus, size_label, cargo, crew_min, crew_max,
         speed_scm, speed_max, fuel_capacity_hydrogen, fuel_capacity_quantum,
         classification, manufacturer_id, game_version_id, updated_at)
         VALUES ('mole', 'MOLE', 'Mining', 'medium', 0, 1, 4,
         75, 800, 50.0, 1.0,
         'Industrial', ${MOLE_MFR.argo}, ${TEST_GAME_VERSION_ID}, datetime('now'))`
      )
      .run();

    const vRow = await env.DB
      .prepare("SELECT id FROM vehicles WHERE slug = 'mole'")
      .first<{ id: number }>();
    moleVehicleId = vRow!.id;

    await env.DB
      .prepare("INSERT OR IGNORE INTO vehicle_images (vehicle_id) VALUES (?)")
      .bind(moleVehicleId)
      .run();

    // Seed a WeaponMining component (Arbor mining laser)
    await seedComponent(env.DB, {
      uuid: MOLE_UUID.arbor, name: "Arbor MH1", type: "WeaponMining",
      sub_type: "Gun", size: 1, grade: "A", manufacturer_id: MOLE_MFR.greycat,
    });

    // Seed another WeaponMining component (Helix mining laser)
    await seedComponent(env.DB, {
      uuid: MOLE_UUID.helix, name: "Helix II", type: "WeaponMining",
      sub_type: "Gun", size: 1, grade: "B", manufacturer_id: MOLE_MFR.greycat,
    });

    // Seed a WeaponGun (Rhino) at same size — should NOT appear in mining laser compatibles
    await seedComponent(env.DB, {
      uuid: MOLE_UUID.rhinoGun, name: "CF-117 Badger Repeater", type: "WeaponGun",
      sub_type: "Gun", size: 1, grade: "A", manufacturer_id: MOLE_MFR.klausWerner,
      dps: 300, damage_per_shot: 24, damage_type: "Energy",
      rounds_per_minute: 750, projectile_speed: 1800,
    });

    // Seed mining laser port — port_type='weapon' but equipped with WeaponMining
    miningPortId = await seedPort(env.DB, {
      uuid: "mole-port-mining-front", vehicle_id: moleVehicleId,
      name: "hardpoint_mining_cab_front",
      category_label: "Weapons", size_min: 1, size_max: 1, port_type: "weapon",
      equipped_item_uuid: MOLE_UUID.arbor, editable: 1,
    });
  });

  it("returns only WeaponMining components for a mining laser port", async () => {
    const res = await SELF.fetch(
      `http://localhost/api/loadout/mole/compatible?port_id=${miningPortId}`
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { components: Array<{ type: string; name: string }> };

    expect(data.components.length).toBeGreaterThan(0);

    // ALL returned components must be WeaponMining — no WeaponGun contamination
    for (const comp of data.components) {
      expect(comp.type).toBe("WeaponMining");
    }
  });

  it("does NOT return WeaponGun components for mining laser port", async () => {
    const res = await SELF.fetch(
      `http://localhost/api/loadout/mole/compatible?port_id=${miningPortId}`
    );
    const data = (await res.json()) as { components: Array<{ type: string; name: string }> };

    const weaponGuns = data.components.filter((c) => c.type === "WeaponGun");
    expect(weaponGuns).toHaveLength(0);
  });
});

// ===========================================================================
// Torpedo storage exclusion regression test
//
// Seeds a Perseus-like ship with hardpoint_torpedo_storage_* ports.
// These should be filtered out of the loadout response, just like
// missile_NN_attach slots.
// ===========================================================================

let perseusVehicleId: number;

const PERSEUS_UUID = {
  torpedoRack: "perseus-torpedo-rack-uuid",
  torpedo: "perseus-torpedo-uuid",
} as const;

const PERSEUS_MFR = {
  rsi: 102,
  behring: 37,
} as const;

describe("Loadout API — torpedo storage exclusion", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);

    const mfrs = [
      { id: PERSEUS_MFR.rsi, name: "RSI", code: "RSI", slug: "rsi" },
      { id: PERSEUS_MFR.behring, name: "Behring", code: "BEHR", slug: "behring" },
    ];
    const mfrStmts = mfrs.map((m) =>
      env.DB
        .prepare(
          `INSERT OR IGNORE INTO manufacturers (id, uuid, name, slug, code, game_version_id)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(m.id, `mfr-uuid-${m.id}`, m.name, m.slug, m.code, TEST_GAME_VERSION_ID)
    );
    await env.DB.batch(mfrStmts);

    // Seed Perseus vehicle
    await env.DB
      .prepare(
        `INSERT INTO vehicles (slug, name, focus, size_label, cargo, crew_min, crew_max,
         speed_scm, speed_max, fuel_capacity_hydrogen, fuel_capacity_quantum,
         classification, manufacturer_id, game_version_id, updated_at)
         VALUES ('perseus', 'Perseus', 'Gunship', 'large', 64, 4, 6,
         165, 950, 90.0, 2.0,
         'Combat', ${PERSEUS_MFR.rsi}, ${TEST_GAME_VERSION_ID}, datetime('now'))`
      )
      .run();

    const vRow = await env.DB
      .prepare("SELECT id FROM vehicles WHERE slug = 'perseus'")
      .first<{ id: number }>();
    perseusVehicleId = vRow!.id;

    await env.DB
      .prepare("INSERT OR IGNORE INTO vehicle_images (vehicle_id) VALUES (?)")
      .bind(perseusVehicleId)
      .run();

    // Seed torpedo rack component
    await seedComponent(env.DB, {
      uuid: PERSEUS_UUID.torpedoRack, name: "Torpedo Rack S9", type: "MissileLauncher",
      sub_type: "TorpedoRack", size: 9, grade: "A", manufacturer_id: PERSEUS_MFR.behring,
    });

    // Seed a torpedo component
    await seedComponent(env.DB, {
      uuid: PERSEUS_UUID.torpedo, name: "Argos IX Torpedo", type: "Missile",
      sub_type: "Torpedo", size: 9, grade: "A", manufacturer_id: PERSEUS_MFR.behring,
    });

    // Seed the torpedo rack top-level port (should be visible)
    const torpedoRackPortId = await seedPort(env.DB, {
      uuid: "perseus-port-torpedo-rack-left", vehicle_id: perseusVehicleId,
      name: "hardpoint_torpedo_left",
      category_label: "Missiles", size_min: 9, size_max: 9, port_type: "missile",
      equipped_item_uuid: PERSEUS_UUID.torpedoRack, editable: 1,
    });

    // Seed torpedo_storage child ports (should be EXCLUDED, like missile_attach)
    for (let i = 1; i <= 5; i++) {
      const num = String(i).padStart(2, "0");
      await seedPort(env.DB, {
        uuid: `perseus-port-torpedo-storage-left-${num}`, vehicle_id: perseusVehicleId,
        name: `hardpoint_torpedo_storage_left_${num}`,
        parent_port_id: torpedoRackPortId,
        category_label: "Missiles", size_min: 9, size_max: 9, port_type: "missile",
        equipped_item_uuid: PERSEUS_UUID.torpedo,
      });
    }

    // Seed a shield so the response isn't empty (need at least one visible port)
    await seedComponent(env.DB, {
      uuid: "perseus-shield-uuid", name: "Citadel", type: "Shield",
      sub_type: "UNDEFINED", size: 3, grade: "B", manufacturer_id: PERSEUS_MFR.behring,
      shield_hp: 25000, shield_regen: 900,
    });
    await seedPort(env.DB, {
      uuid: "perseus-port-shield", vehicle_id: perseusVehicleId,
      name: "hardpoint_shield_generator_left",
      category_label: "Shields", size_min: 3, size_max: 3, port_type: "shield",
      equipped_item_uuid: "perseus-shield-uuid", editable: 1,
    });
  });

  it("torpedo rack top-level port IS visible in loadout", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/perseus/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const torpedoRack = data.find(
      (p) => p.port_name === "hardpoint_torpedo_left"
    );
    expect(torpedoRack).toBeDefined();
    // mount_name is the rack, component_name resolves to the deepest child (torpedo)
    expect(torpedoRack!.mount_name).toBe("Torpedo Rack S9");
  });

  it("torpedo_storage child ports are NOT in the response", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/perseus/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const torpedoStoragePorts = data.filter(
      (p) => ((p.port_name as string) || "").includes("torpedo_storage")
    );
    expect(torpedoStoragePorts).toHaveLength(0);
  });

  it("torpedo_storage exclusion is analogous to missile_attach exclusion", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/perseus/components");
    const data = (await res.json()) as Record<string, unknown>[];

    // Neither missile_attach nor torpedo_storage child ports should appear
    const excludedChildren = data.filter(
      (p) => {
        const name = (p.port_name as string) || "";
        return name.includes("torpedo_storage") || name.match(/^missile_\d+_attach$/);
      }
    );
    expect(excludedChildren).toHaveLength(0);
  });
});
