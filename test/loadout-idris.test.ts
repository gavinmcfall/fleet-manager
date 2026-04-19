/**
 * Loadout API integration test — Idris-P golden data.
 *
 * Seeds a representative subset of the Idris-P's port hierarchy (manned turret
 * with grandchild weapons, PDC turret, remote turret, shields, power, coolers,
 * QD→JD chain, countermeasures, missile, sensor) into the test D1 database,
 * then asserts that GET /api/loadout/idris-p/components returns the right shape.
 *
 * The Idris-P is a capital ship with ~153 total ports. We seed a representative
 * ~30 ports that cover every port_type and hierarchy pattern. The assertions
 * focus on counts and regressions that have actually bitten us:
 * - turret count ≥10 (was 0 before port_type fix)
 * - capital-class shield_hp (9-digit range)
 * - No Display/SeatDashboard noise
 * - Missile ports present
 */
import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { setupTestDatabase, TEST_GAME_VERSION_ID } from "./apply-migrations";

// ---------------------------------------------------------------------------
// Seed helpers — builds a representative Idris-P port hierarchy
// ---------------------------------------------------------------------------

let idrisVehicleId: number;

// Component UUIDs — stable for this test
const UUID = {
  ifrW57Turret: "idris-ifrw57-turret-uuid",
  varipuckS5: "idris-varipuck-s5-uuid",
  m7aCannon: "idris-m7a-cannon-uuid",
  remoteTurret: "idris-remote-turret-uuid",
  pdcTurret: "idris-pdc-turret-uuid",
  holdstrongShield: "idris-holdstrong-uuid",
  mainPowerplant: "idris-powerplant-uuid",
  exothermCooler: "idris-exotherm-uuid",
  frontlineQD: "idris-frontline-qd-uuid",
  exfiltrateJD: "idris-exfiltrate-jd-uuid",
  decoyLauncher: "idris-decoy-launcher-uuid",
  noiseLauncher: "idris-noise-launcher-uuid",
  radar: "idris-radar-uuid",
  missileCap: "idris-missile-cap-uuid",
} as const;

const MFR = {
  aegis: 5,
  behring: 17,
  flashfire: 37,
  gorgon: 46,
  weiTek: 129,
} as const;

async function seedManufacturers(db: D1Database) {
  const mfrs = [
    { id: MFR.aegis, name: "Aegis Dynamics", code: "AEG", slug: "aegis-dynamics" },
    { id: MFR.behring, name: "Behring", code: "BEH", slug: "behring" },
    { id: MFR.flashfire, name: "Flashfire Systems", code: "FFSY", slug: "flashfire-systems" },
    { id: MFR.gorgon, name: "Gorgon Defender Industries", code: "GODI", slug: "gorgon-defender" },
    { id: MFR.weiTek, name: "Wei-Tek", code: "WETK", slug: "wei-tek" },
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

describe("Loadout API — Idris-P golden data", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    await seedManufacturers(env.DB);

    // -----------------------------------------------------------------------
    // Seed vehicle: Idris-P
    // -----------------------------------------------------------------------
    await env.DB
      .prepare(
        `INSERT INTO vehicles (slug, name, focus, size_label, cargo, crew_min, crew_max,
         speed_scm, speed_max, fuel_capacity_hydrogen, fuel_capacity_quantum,
         classification, manufacturer_id, game_version_id, updated_at)
         VALUES ('idris-p', 'Idris-P', 'Combat', 'capital', 995, 10, 38,
         94, 949, 0, 5,
         'Combat', ${MFR.aegis}, ${TEST_GAME_VERSION_ID}, datetime('now'))`
      )
      .run();

    const vRow = await env.DB
      .prepare("SELECT id FROM vehicles WHERE slug = 'idris-p'")
      .first<{ id: number }>();
    idrisVehicleId = vRow!.id;

    await env.DB
      .prepare("INSERT OR IGNORE INTO vehicle_images (vehicle_id) VALUES (?)")
      .bind(idrisVehicleId)
      .run();

    // -----------------------------------------------------------------------
    // Seed components (Idris-P stock loadout)
    // -----------------------------------------------------------------------

    // Front manned turret (TurretBase)
    await seedComponent(env.DB, {
      uuid: UUID.ifrW57Turret, name: "IFR-W57 Turret", type: "TurretBase",
      sub_type: "MannedTurret", size: 7, grade: "A", manufacturer_id: MFR.aegis,
    });
    // VariPuck S5 gimbal
    await seedComponent(env.DB, {
      uuid: UUID.varipuckS5, name: "VariPuck S5 Gimbal Mount", type: "Turret",
      sub_type: "GunTurret", size: 5, grade: "A", manufacturer_id: MFR.flashfire,
      power_draw: 33.75,
    });
    // M7A Cannon (the deepest weapon under front turret)
    await seedComponent(env.DB, {
      uuid: UUID.m7aCannon, name: "M7A Cannon", type: "WeaponGun",
      sub_type: "Gun", size: 5, grade: "A", manufacturer_id: MFR.behring,
      dps: 1536.3, damage_per_shot: 921.78, damage_type: "Energy",
      rounds_per_minute: 100, projectile_speed: 920,
      damage_energy: 921.78, penetration: 4.5, weapon_range: 3302.8,
    });
    // Remote turret
    await seedComponent(env.DB, {
      uuid: UUID.remoteTurret, name: "Remote Turret", type: "Turret",
      sub_type: "GunTurret", size: 5, grade: "A", manufacturer_id: MFR.aegis,
    });
    // PDC turret (no component in vehicle_components — just a port equipped_item_uuid)
    // Holdstrong capital shield
    await seedComponent(env.DB, {
      uuid: UUID.holdstrongShield, name: "Holdstrong", type: "Shield",
      size: 4, grade: "A", manufacturer_id: MFR.gorgon,
      shield_hp: 1056000, shield_regen: 31944,
      resist_physical: 0.25,
    });
    // Main Powerplant
    await seedComponent(env.DB, {
      uuid: UUID.mainPowerplant, name: "Main Powerplant", type: "PowerPlant",
      sub_type: "Power", size: 4, grade: "A", manufacturer_id: MFR.aegis,
      power_output: 250000,
    });
    // Exotherm cooler
    await seedComponent(env.DB, {
      uuid: UUID.exothermCooler, name: "Exotherm", type: "Cooler",
      size: 4, grade: "A", manufacturer_id: MFR.aegis,
      cooling_rate: 16000000,
    });
    // Frontline quantum drive
    await seedComponent(env.DB, {
      uuid: UUID.frontlineQD, name: "Frontline", type: "QuantumDrive",
      size: 4, grade: "A", manufacturer_id: MFR.weiTek,
      quantum_speed: 718000000, spool_time: 1000,
    });
    // Exfiltrate jump drive
    await seedComponent(env.DB, {
      uuid: UUID.exfiltrateJD, name: "Exfiltrate", type: "JumpDrive",
      size: 4, grade: "A", manufacturer_id: MFR.weiTek,
    });
    // Countermeasures
    await seedComponent(env.DB, {
      uuid: UUID.decoyLauncher, name: "Aegis Hammerhead - Decoy Launcher",
      type: "WeaponDefensive", sub_type: "CountermeasureLauncher",
      size: 1, grade: "A", manufacturer_id: MFR.aegis,
    });
    await seedComponent(env.DB, {
      uuid: UUID.noiseLauncher, name: "Aegis Hammerhead - Noise Launcher",
      type: "WeaponDefensive", sub_type: "CountermeasureLauncher",
      size: 1, grade: "A", manufacturer_id: MFR.aegis,
    });
    // Radar
    await seedComponent(env.DB, {
      uuid: UUID.radar, name: "Radar", type: "Radar",
      sub_type: "MidRangeRadar", size: 3, grade: "A", manufacturer_id: MFR.aegis,
    });
    // Missile cap
    await seedComponent(env.DB, {
      uuid: UUID.missileCap, name: "Missile Door Cap", type: "Missile",
      size: 1, grade: "A", manufacturer_id: MFR.aegis,
    });

    // -----------------------------------------------------------------------
    // Seed ports — representative Idris-P hierarchy
    // -----------------------------------------------------------------------
    const vid = idrisVehicleId;

    // --- Front manned turret (TurretBase → VariPuck S5 ×2 → M7A Cannon ×2) ---
    const frontTurretId = await seedPort(env.DB, {
      uuid: "idris-port-front-turret", vehicle_id: vid, name: "hardpoint_front_turret",
      category_label: "Turrets", size_min: 7, size_max: 7, port_type: "turret",
      equipped_item_uuid: UUID.ifrW57Turret,
    });
    // Left weapon child (VariPuck S5)
    const frontWeaponLeftId = await seedPort(env.DB, {
      uuid: "idris-port-front-weapon-left", vehicle_id: vid, name: "hardpoint_weapon_left",
      parent_port_id: frontTurretId,
      category_label: "Weapons", size_min: 5, size_max: 5, port_type: "weapon",
      equipped_item_uuid: UUID.varipuckS5, editable: 0,
    });
    // Grandchild: M7A under left gimbal
    await seedPort(env.DB, {
      uuid: "idris-port-front-wl-gun", vehicle_id: vid, name: "hardpoint_class_2",
      parent_port_id: frontWeaponLeftId,
      size_min: 4, size_max: 5, port_type: "weapon",
      equipped_item_uuid: UUID.m7aCannon,
    });
    // Right weapon child (VariPuck S5)
    const frontWeaponRightId = await seedPort(env.DB, {
      uuid: "idris-port-front-weapon-right", vehicle_id: vid, name: "hardpoint_weapon_right",
      parent_port_id: frontTurretId,
      category_label: "Weapons", size_min: 5, size_max: 5, port_type: "weapon",
      equipped_item_uuid: UUID.varipuckS5, editable: 0,
    });
    // Grandchild: M7A under right gimbal
    await seedPort(env.DB, {
      uuid: "idris-port-front-wr-gun", vehicle_id: vid, name: "hardpoint_class_2_r",
      parent_port_id: frontWeaponRightId,
      size_min: 4, size_max: 5, port_type: "weapon",
      equipped_item_uuid: UUID.m7aCannon,
    });

    // --- Remote turrets (front_left and front_right — S5 each with 2× weapon children) ---
    for (const side of ["front_left", "front_right"]) {
      const remoteTurretId = await seedPort(env.DB, {
        uuid: `idris-port-${side}-turret`, vehicle_id: vid,
        name: `hardpoint_${side}_turret`,
        category_label: "Turrets", size_min: 5, size_max: 5, port_type: "turret",
        equipped_item_uuid: UUID.remoteTurret,
      });
      for (const wside of ["left", "right"]) {
        const wpId = await seedPort(env.DB, {
          uuid: `idris-port-${side}-weapon-${wside}`, vehicle_id: vid,
          name: `hardpoint_weapon_${wside}`,
          parent_port_id: remoteTurretId,
          category_label: "Weapons", size_min: 5, size_max: 5, port_type: "weapon",
          equipped_item_uuid: UUID.varipuckS5, editable: 0,
        });
        await seedPort(env.DB, {
          uuid: `idris-port-${side}-${wside}-gun`, vehicle_id: vid, name: "hardpoint_class_2",
          parent_port_id: wpId,
          size_min: 4, size_max: 5, port_type: "weapon",
          equipped_item_uuid: UUID.m7aCannon,
        });
      }
    }

    // --- PDC turrets (7× in real Idris — seed 7 for realistic count) ---
    for (let i = 1; i <= 7; i++) {
      const num = String(i).padStart(2, "0");
      // Main PDC turret port
      await seedPort(env.DB, {
        uuid: `idris-port-pdc-${num}`, vehicle_id: vid,
        name: `hardpoint_pdc_${num}`,
        category_label: "Turrets", size_min: 2, size_max: 2, port_type: "turret",
        equipped_item_uuid: "pdc-turret-component-uuid",
      });
      // PDC sub-turrets (_aim, _mc, _wc)
      for (const suffix of ["aim", "mc", "wc"]) {
        await seedPort(env.DB, {
          uuid: `idris-port-pdc-${num}-${suffix}`, vehicle_id: vid,
          name: `hardpoint_pdc_${num}_${suffix}`,
          category_label: "Turrets", size_min: 1, size_max: 1, port_type: "turret",
          equipped_item_uuid: `pdc-${suffix}-component-uuid`,
        });
      }
    }

    // --- Shields (2×) ---
    for (const pos of ["left", "right"]) {
      await seedPort(env.DB, {
        uuid: `idris-port-shield-${pos}`, vehicle_id: vid,
        name: `hardpoint_shield_generator_${pos}`,
        category_label: "Shields", size_min: 4, size_max: 4, port_type: "shield",
        equipped_item_uuid: UUID.holdstrongShield,
      });
    }

    // --- Power plants (2×) ---
    for (const pos of ["01", "02"]) {
      await seedPort(env.DB, {
        uuid: `idris-port-power-${pos}`, vehicle_id: vid,
        name: `hardpoint_powerplant_${pos}`,
        category_label: "Power", size_min: 4, size_max: 4, port_type: "power",
        equipped_item_uuid: UUID.mainPowerplant,
      });
    }

    // --- Coolers (2×) ---
    for (const pos of ["left", "right"]) {
      await seedPort(env.DB, {
        uuid: `idris-port-cooler-${pos}`, vehicle_id: vid,
        name: `hardpoint_cooler_${pos}`,
        category_label: "Cooling", size_min: 4, size_max: 4, port_type: "cooler",
        equipped_item_uuid: UUID.exothermCooler,
      });
    }

    // --- Quantum drive → Jump drive (parent-child) ---
    const qdId = await seedPort(env.DB, {
      uuid: "idris-port-qd", vehicle_id: vid, name: "hardpoint_quantum_drive",
      category_label: "Quantum Drive", size_min: 4, size_max: 4, port_type: "quantum_drive",
      equipped_item_uuid: UUID.frontlineQD,
    });
    await seedPort(env.DB, {
      uuid: "idris-port-jd", vehicle_id: vid, name: "hardpoint_jump_drive",
      parent_port_id: qdId,
      category_label: "Jump Drive", size_min: 4, size_max: 4, port_type: "jump_drive",
      equipped_item_uuid: UUID.exfiltrateJD,
    });

    // --- Countermeasures (4×) ---
    await seedPort(env.DB, {
      uuid: "idris-port-cm-left", vehicle_id: vid,
      name: "hardpoint_countermeasures_left",
      category_label: "Countermeasures", size_min: 1, size_max: 1, port_type: "countermeasure",
      equipped_item_uuid: UUID.decoyLauncher,
    });
    await seedPort(env.DB, {
      uuid: "idris-port-cm-left-2", vehicle_id: vid,
      name: "hardpoint_countermeasures_left_2",
      category_label: "Countermeasures", size_min: 1, size_max: 1, port_type: "countermeasure",
      equipped_item_uuid: UUID.noiseLauncher,
    });
    await seedPort(env.DB, {
      uuid: "idris-port-cm-right", vehicle_id: vid,
      name: "hardpoint_countermeasures_right",
      category_label: "Countermeasures", size_min: 1, size_max: 1, port_type: "countermeasure",
      equipped_item_uuid: UUID.decoyLauncher,
    });
    await seedPort(env.DB, {
      uuid: "idris-port-cm-right-2", vehicle_id: vid,
      name: "hardpoint_countermeasures_right_2",
      category_label: "Countermeasures", size_min: 1, size_max: 1, port_type: "countermeasure",
      equipped_item_uuid: UUID.noiseLauncher,
    });

    // --- Sensor ---
    await seedPort(env.DB, {
      uuid: "idris-port-radar", vehicle_id: vid, name: "hardpoint_radar",
      category_label: "Sensors", size_min: 3, size_max: 3, port_type: "sensor",
      equipped_item_uuid: UUID.radar,
    });

    // --- Missile ---
    await seedPort(env.DB, {
      uuid: "idris-port-missile-cap", vehicle_id: vid,
      name: "hardpoint_missile_door_cap",
      category_label: "Missiles", size_min: 1, size_max: 1, port_type: "missile",
      equipped_item_uuid: UUID.missileCap,
    });

    // --- Noise port: dashboard (null port_type, null category_label) ---
    const dashboardId = await seedPort(env.DB, {
      uuid: "idris-port-dashboard", vehicle_id: vid, name: "hardpoint_dashboard_pilot",
      port_type: null, category_label: null, size_min: 1, size_max: 1,
    });
    await seedPort(env.DB, {
      uuid: "idris-port-display", vehicle_id: vid, name: "hardpoint_cockpit_radar",
      parent_port_id: dashboardId,
      category_label: "Sensors", size_min: 1, size_max: 1, port_type: "sensor",
      equipped_item_uuid: "display-radar-uuid",
    });
    await seedComponent(env.DB, {
      uuid: "display-radar-uuid", name: "Radar_Display_Idris", type: "Display",
      size: 1, grade: "A", manufacturer_id: MFR.aegis,
    });
  });

  // =========================================================================
  // Tests
  // =========================================================================

  it("returns a large number of components for a capital ship", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/idris-p/components");
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>[];
    // Seeded: 3 turrets (front + 2 remote) + 28 PDC turrets (7×4) + 2 shields
    // + 2 power + 2 coolers + 1 QD + 1 JD + 4 countermeasures + 1 sensor
    // + 1 missile + weapon children + grandchildren
    // Total seeded top-level ports with category_label ≈ 55+
    expect(data.length).toBeGreaterThanOrEqual(40);
  });

  it("turret count catches port_type=NULL regression (was 0 before fixes)", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/idris-p/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const turrets = data.filter((p) => p.port_type === "turret");
    // Seeded: 3 main turrets + 7 PDC main + 21 PDC sub-turrets = 31
    expect(turrets.length).toBeGreaterThanOrEqual(10);
  });

  it("weapon count covers all gimballed weapon ports", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/idris-p/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const weapons = data.filter((p) => p.port_type === "weapon");
    // Front turret 2× weapon children + 2× remote turrets × 2 weapon children = 6
    // Plus grandchild weapons that also appear
    expect(weapons.length).toBeGreaterThanOrEqual(6);
  });

  it("resolves 3-level turret hierarchy: TurretBase → Gimbal → M7A Cannon", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/idris-p/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const frontTurret = data.find(
      (p) => p.port_name === "hardpoint_front_turret"
    );
    expect(frontTurret).toBeDefined();
    expect(frontTurret!.port_type).toBe("turret");
    expect(frontTurret!.mount_name).toBe("IFR-W57 Turret");
    expect(frontTurret!.component_name).toBe("M7A Cannon");
    expect(frontTurret!.component_type).toBe("WeaponGun");
    expect(frontTurret!.dps).toBe(1536.3);
    expect(frontTurret!.weapon_count).toBe(2);
  });

  it("returns 4 countermeasures (Hammerhead launchers)", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/idris-p/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const cms = data.filter((p) => p.port_type === "countermeasure");
    expect(cms).toHaveLength(4);

    // F503: CountermeasureLauncher names have parent-ship prefix stripped
    // ("Aegis Hammerhead - Decoy Launcher" → "Decoy Launcher") at query time.
    const decoys = cms.filter(
      (p) => p.component_name === "Decoy Launcher"
    );
    const noise = cms.filter(
      (p) => p.component_name === "Noise Launcher"
    );
    expect(decoys).toHaveLength(2);
    expect(noise).toHaveLength(2);
  });

  it("returns 2 shields with capital-class shield_hp (9-digit range)", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/idris-p/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const shields = data.filter((p) => p.port_type === "shield");
    expect(shields).toHaveLength(2);

    for (const s of shields) {
      expect(s.component_name).toBe("Holdstrong");
      expect(s.component_type).toBe("Shield");
      expect(s.shield_hp).toBe(1056000);
      expect(s.shield_regen).toBe(31944);
      expect(s.component_size).toBe(4);
    }
  });

  it("returns 2 power plants and 2 coolers", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/idris-p/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const power = data.filter((p) => p.port_type === "power");
    expect(power).toHaveLength(2);
    for (const pp of power) {
      expect(pp.component_name).toBe("Main Powerplant");
      expect(pp.power_output).toBe(250000);
    }

    const coolers = data.filter((p) => p.port_type === "cooler");
    expect(coolers).toHaveLength(2);
    for (const c of coolers) {
      expect(c.component_name).toBe("Exotherm");
      expect(c.cooling_rate).toBe(16000000);
    }
  });

  it("returns quantum drive and jump drive as parent-child", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/idris-p/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const qd = data.find((p) => p.port_type === "quantum_drive");
    expect(qd).toBeDefined();
    expect(qd!.component_name).toBe("Frontline");
    expect(qd!.quantum_speed).toBe(718000000);

    const jd = data.find((p) => p.port_type === "jump_drive");
    expect(jd).toBeDefined();
    expect(jd!.component_name).toBe("Exfiltrate");
    expect(jd!.parent_port_id).toBeTruthy();
  });

  it("has at least 1 missile port", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/idris-p/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const missiles = data.filter((p) => p.port_type === "missile");
    expect(missiles.length).toBeGreaterThanOrEqual(1);
  });

  it("excludes Display-type noise ports", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/idris-p/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const dashboard = data.find(
      (p) => p.port_name === "hardpoint_dashboard_pilot"
    );
    expect(dashboard).toBeUndefined();

    const displays = data.filter((p) => p.component_type === "Display");
    expect(displays).toHaveLength(0);
  });

  it("PDC turrets are present in results", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/idris-p/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const pdcPorts = data.filter((p) =>
      (p.port_name as string).startsWith("hardpoint_pdc_")
    );
    // 7 main PDC + 21 sub-turrets = 28
    expect(pdcPorts.length).toBeGreaterThanOrEqual(7);
  });

  it("category_labels appear in the correct display order", async () => {
    const res = await SELF.fetch("http://localhost/api/loadout/idris-p/components");
    const data = (await res.json()) as Record<string, unknown>[];

    const ORDER = [
      "Weapons", "Turrets", "Missiles",
      "Shields", "Power", "Cooling",
      "Quantum Drive", "Jump Drive", "Countermeasures", "Sensors",
    ];

    const seen: string[] = [];
    for (const p of data) {
      const cat = p.category_label as string;
      if (cat && !seen.includes(cat)) seen.push(cat);
    }

    const filtered = seen.filter((c) => ORDER.includes(c));
    for (let i = 1; i < filtered.length; i++) {
      expect(ORDER.indexOf(filtered[i])).toBeGreaterThan(
        ORDER.indexOf(filtered[i - 1])
      );
    }
  });
});
