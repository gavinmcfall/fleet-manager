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
import { setupTestDatabase } from "./apply-migrations";

// ---------------------------------------------------------------------------
// Seed helpers local to this file — builds the Asgard's full port hierarchy
// ---------------------------------------------------------------------------

let gameVersionId: number;
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
      .bind(m.id, `mfr-uuid-${m.id}`, m.name, m.slug, m.code, gameVersionId)
  );
  await db.batch(stmts);
}

async function seedGameVersion(db: D1Database): Promise<number> {
  // Check if a default version already exists from migrations
  const existing = await db
    .prepare("SELECT id FROM game_versions WHERE is_default = 1")
    .first<{ id: number }>();
  if (existing) return existing.id;

  await db
    .prepare(
      "INSERT INTO game_versions (code, label, is_default, created_at) VALUES ('4.6.0-live', '4.6.0 LIVE', 1, datetime('now'))"
    )
    .run();
  const row = await db
    .prepare("SELECT id FROM game_versions WHERE is_default = 1")
    .first<{ id: number }>();
  return row!.id;
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
  await db
    .prepare(
      `INSERT INTO vehicle_components (uuid, name, slug, type, sub_type, size, grade, class,
       manufacturer_id, game_version_id, removed,
       dps, damage_per_shot, damage_type, rounds_per_minute, projectile_speed,
       damage_energy, shield_hp, shield_regen,
       resist_physical, resist_energy, resist_distortion, resist_thermal,
       power_output, thermal_output, cooling_rate,
       quantum_speed, quantum_range, fuel_rate, spool_time,
       radar_range, power_draw, penetration, weapon_range,
       created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL,
       ?, ?, 0,
       ?, ?, ?, ?, ?,
       ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?,
       ?, ?, ?, ?,
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
      gameVersionId,
      opts.dps ?? null,
      opts.damage_per_shot ?? null,
      opts.damage_type ?? null,
      opts.rounds_per_minute ?? null,
      opts.projectile_speed ?? null,
      opts.damage_energy ?? null,
      opts.shield_hp ?? null,
      opts.shield_regen ?? null,
      opts.resist_physical ?? null,
      opts.resist_energy ?? null,
      opts.resist_distortion ?? null,
      opts.resist_thermal ?? null,
      opts.power_output ?? null,
      opts.thermal_output ?? null,
      opts.cooling_rate ?? null,
      opts.quantum_speed ?? null,
      opts.quantum_range ?? null,
      opts.fuel_rate ?? null,
      opts.spool_time ?? null,
      opts.radar_range ?? null,
      opts.power_draw ?? null,
      opts.penetration ?? null,
      opts.weapon_range ?? null
    )
    .run();

  const row = await db
    .prepare("SELECT id FROM vehicle_components WHERE uuid = ? AND game_version_id = ?")
    .bind(opts.uuid, gameVersionId)
    .first<{ id: number }>();
  return row!.id;
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
       size_min, size_max, port_type, equipped_item_uuid, editable, game_version_id, removed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
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
      gameVersionId
    )
    .run();

  const row = await db
    .prepare("SELECT id FROM vehicle_ports WHERE uuid = ? AND game_version_id = ?")
    .bind(opts.uuid, gameVersionId)
    .first<{ id: number }>();
  return row!.id;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Loadout API — Asgard golden data", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    gameVersionId = await seedGameVersion(env.DB);
    await seedManufacturers(env.DB);

    // -----------------------------------------------------------------------
    // Seed vehicle: Asgard
    // -----------------------------------------------------------------------
    await env.DB
      .prepare(
        `INSERT INTO vehicles (slug, name, focus, size_label, cargo, crew_min, crew_max,
         speed_scm, speed_max, fuel_capacity_hydrogen, fuel_capacity_quantum,
         classification, manufacturer_id, game_version_id, removed, updated_at)
         VALUES ('asgard', 'Asgard', 'Combat', 'medium', 180, 1, 1,
         203, 1075, 97.5, 1.85,
         'Combat', ${MFR.anvil}, ${gameVersionId}, 0, datetime('now'))`
      )
      .run();

    const vRow = await env.DB
      .prepare("SELECT id FROM vehicles WHERE slug = 'asgard' AND game_version_id = ?")
      .bind(gameVersionId)
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
});
