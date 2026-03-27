import { Hono } from "hono";
import { z } from "zod";
import { getAuthUser, type HonoEnv } from "../lib/types";
import { validate } from "../lib/validation";
import { versionSubquery, deltaVersionJoin } from "../lib/constants";
import { cachedJson, resolveVersionId, cacheSlug } from "../lib/cache";
import { getShipLoadout, getShipModules } from "../db/queries";

// D1 has a 100-parameter limit per prepared statement.
// Batch an IN-clause query into chunks, merging all results.
const BATCH_SIZE = 50;
async function batchInQuery<T>(
  db: D1Database,
  items: string[],
  buildQuery: (placeholders: string) => string,
  preBind: unknown[] = [],
): Promise<T[]> {
  if (items.length === 0) return [];
  const results: T[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const placeholders = chunk.map(() => "?").join(",");
    const rows = await db
      .prepare(buildQuery(placeholders))
      .bind(...preBind, ...chunk)
      .all();
    results.push(...(rows.results as T[]));
  }
  return results;
}

// --- Validation schemas ---

const LoadoutBody = z.object({
  overrides: z.array(z.object({
    port_id: z.number().int().positive(),
    component_id: z.number().int().positive(),
  })),
});

const CartAddBody = z.object({
  items: z.array(z.object({
    component_id: z.number().int().positive(),
    shop_id: z.number().int().positive().optional(),
    source_fleet_id: z.number().int().positive().optional(),
    quantity: z.number().int().min(1).default(1),
  })),
});

const CartUpdateBody = z.object({
  shop_id: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().min(1).optional(),
});

// --- Map port_type (vehicle_ports) → component type (vehicle_components) ---
// vehicle_ports uses lowercase, vehicle_components uses PascalCase
const PORT_TYPE_TO_COMPONENT_TYPE: Record<string, string[]> = {
  power: ["PowerPlant"],
  cooler: ["Cooler"],
  shield: ["Shield"],
  quantum_drive: ["QuantumDrive"],
  weapon: ["WeaponGun"],
  turret: ["TurretBase", "Turret"],
  missile: ["MissileLauncher", "BombLauncher"],
  sensor: ["Radar", "Scanner"],
  countermeasure: ["WeaponDefensive"],
  mining_laser: ["WeaponMining"],
  salvage_head: ["SalvageHead"],
  salvage_module: ["SalvageModifier", "MiningModifier"],
  qed: ["QuantumInterdictionGenerator"],
  jump_drive: ["JumpDrive"],
};

// --- Stat sort keys per component type ---
const STAT_SORT_KEY: Record<string, string> = {
  PowerPlant: "vc.power_output",
  Cooler: "vc.cooling_rate",
  Shield: "vc.shield_hp",
  QuantumDrive: "vc.quantum_speed",
  WeaponGun: "vc.dps",
  Radar: "vc.radar_range",
  MissileLauncher: "vc.damage",
  TurretBase: "vc.dps",
  Turret: "vc.dps",
  QuantumInterdictionGenerator: "vc.qed_range",
};

/**
 * /api/loadout/* — Ship loadout builder (public compatible components, auth-gated customization)
 */
export function loadoutRoutes() {
  const app = new Hono<HonoEnv>();

  // ============================================================
  //  PUBLIC — Compatible components for a ship port
  // ============================================================

  // GET /api/loadout/:slug/components — full loadout (stock) for any ship
  app.get("/:slug/components", async (c) => {
    const slug = c.req.param("slug");
    const patch = c.req.query("patch");
    const versionId = await resolveVersionId(c.env.DB, patch);
    return cachedJson(c, `loadout:components:${versionId}:${cacheSlug(slug)}`, async () => {
      return getShipLoadout(c.env.DB, slug, versionId);
    });
  });

  // GET /api/loadout/:slug/modules — available modules for module ports
  app.get("/:slug/modules", async (c) => {
    const slug = c.req.param("slug");
    const patch = c.req.query("patch");
    const versionId = await resolveVersionId(c.env.DB, patch);
    return cachedJson(c, `loadout:modules:${versionId}:${cacheSlug(slug)}`, async () => {
      return getShipModules(c.env.DB, slug, versionId);
    });
  });

  // GET /api/loadout/:slug/compatible?port_id=N&patch=X — all components fitting a port
  app.get("/:slug/compatible", async (c) => {
    const db = c.env.DB;
    const portIdStr = c.req.query("port_id");
    const patch = c.req.query("patch");

    if (!portIdStr) return c.json({ error: "port_id required" }, 400);
    const portId = parseInt(portIdStr, 10);
    if (isNaN(portId)) return c.json({ error: "port_id must be a number" }, 400);

    const versionId = await resolveVersionId(db, patch);
    const vq = versionSubquery(versionId);

    // Get port info (type + size range)
    const dvjPorts = deltaVersionJoin('vehicle_ports', 'vp', 'uuid', versionId);
    const port = await db
      .prepare(
        `SELECT vp.port_type, vp.size_min, vp.size_max, vp.equipped_item_uuid
         FROM vehicle_ports vp
         ${dvjPorts}
         WHERE vp.id = ?`,
      )
      .bind(portId)
      .first<{ port_type: string; size_min: number; size_max: number; equipped_item_uuid: string | null }>();

    if (!port) return c.json({ error: "Port not found" }, 404);

    // Map port_type → component types (port_type is lowercase, component types are PascalCase)
    // Some ports (turrets, weapons) have null port_type — infer from port name
    let resolvedPortType = port.port_type;
    if (!resolvedPortType) {
      const portInfo = await db
        .prepare("SELECT name FROM vehicle_ports WHERE id = ?")
        .bind(portId)
        .first<{ name: string }>();
      const pn = (portInfo?.name || "").toLowerCase();
      if (pn.includes("turret")) resolvedPortType = "turret";
      else if (pn.includes("weapon") || pn.includes("gun")) resolvedPortType = "weapon";
      else if (pn.includes("missile")) resolvedPortType = "missile";
    }

    // Ports with size 0-0 are structural mounts (turret housings, fixed brackets)
    // that aren't player-swappable — return empty with explanation
    if (port.size_min === 0 && port.size_max === 0) {
      return c.json({
        port_id: portId,
        port_type: resolvedPortType,
        size_min: 0,
        size_max: 0,
        stock_uuid: port.equipped_item_uuid,
        components: [],
        note: "This is a fixed mount — swap components on the child weapon ports instead",
      });
    }

    // If the port has an equipped component, use its actual type to narrow compatible options.
    // This handles mining lasers (port_type='weapon' but component_type='WeaponMining') and
    // salvage heads (port_type='weapon' but component_type='SalvageModifier').
    // NOTE: We check the RESOLVED component (deepest child via loadout CTE), not the raw
    // equipped_item_uuid, because turret ports reference the housing, not the actual tool.
    let componentTypes = PORT_TYPE_TO_COMPONENT_TYPE[resolvedPortType] || [resolvedPortType || "UNKNOWN"];

    // Check both the direct equipped item AND the resolved deepest component
    const COMPONENT_TYPE_OVERRIDES: Record<string, string[]> = {
      WeaponMining: ["WeaponMining"],
      SalvageHead: ["SalvageHead"],
      SalvageModifier: ["SalvageModifier"],
      MiningModifier: ["MiningModifier"],
      TractorBeam: ["TractorBeam"],
      ToolArm: ["TractorBeam", "ToolArm"],
      UtilityTurret: [], // check children instead
    };

    // First try the port's own equipped item
    let resolvedComponentType: string | null = null;
    if (port.equipped_item_uuid) {
      const equipped = await db
        .prepare(`SELECT type FROM vehicle_components WHERE uuid = ? AND game_version_id = (SELECT MAX(game_version_id) FROM vehicle_components WHERE uuid = ? AND game_version_id <= ${vq})`)
        .bind(port.equipped_item_uuid, port.equipped_item_uuid)
        .first<{ type: string }>();
      resolvedComponentType = equipped?.type || null;
    }

    // If the direct item is a turret/housing, walk the port tree to find the deepest
    // child's component_type AND size range. The user is swapping the child, not the housing.
    let resolvedSizeMin = port.size_min;
    let resolvedSizeMax = port.size_max;
    if (!resolvedComponentType || resolvedComponentType === "UtilityTurret" || resolvedComponentType === "TurretBase" || resolvedComponentType === "Turret") {
      const loadoutRow = await db
        .prepare(`SELECT component_type, child_size_min, child_size_max FROM (${
          `SELECT
             CASE WHEN gccomp.type IS NOT NULL THEN gccomp.type
                  WHEN childcomp.type IS NOT NULL THEN childcomp.type
                  ELSE mount.type END as component_type,
             CASE WHEN grandchild.id IS NOT NULL THEN grandchild.size_min
                  WHEN child.id IS NOT NULL THEN child.size_min
                  ELSE p.size_min END as child_size_min,
             CASE WHEN grandchild.id IS NOT NULL THEN grandchild.size_max
                  WHEN child.id IS NOT NULL THEN child.size_max
                  ELSE p.size_max END as child_size_max
           FROM vehicle_ports p
           LEFT JOIN vehicle_components mount ON mount.uuid = p.equipped_item_uuid
             AND mount.game_version_id = (SELECT MAX(game_version_id) FROM vehicle_components WHERE uuid = p.equipped_item_uuid AND game_version_id <= ${vq})
           LEFT JOIN vehicle_ports child ON child.parent_port_id = p.id AND child.game_version_id = p.game_version_id
           LEFT JOIN vehicle_components childcomp ON childcomp.uuid = child.equipped_item_uuid
             AND childcomp.game_version_id = (SELECT MAX(game_version_id) FROM vehicle_components WHERE uuid = child.equipped_item_uuid AND game_version_id <= ${vq})
           LEFT JOIN vehicle_ports grandchild ON grandchild.parent_port_id = child.id AND grandchild.game_version_id = child.game_version_id
           LEFT JOIN vehicle_components gccomp ON gccomp.uuid = grandchild.equipped_item_uuid
             AND gccomp.game_version_id = (SELECT MAX(game_version_id) FROM vehicle_components WHERE uuid = grandchild.equipped_item_uuid AND game_version_id <= ${vq})
           WHERE p.id = ?
           ORDER BY CASE WHEN gccomp.type IS NOT NULL THEN 0 WHEN childcomp.type IS NOT NULL THEN 1 ELSE 2 END
           LIMIT 1`
        }) sub`)
        .bind(portId)
        .first<{ component_type: string; child_size_min: number; child_size_max: number }>();
      if (loadoutRow?.component_type) {
        resolvedComponentType = loadoutRow.component_type;
        // Use the child port's size range instead of the turret housing size
        if (loadoutRow.child_size_min != null) resolvedSizeMin = loadoutRow.child_size_min;
        if (loadoutRow.child_size_max != null) resolvedSizeMax = loadoutRow.child_size_max;
      }
    }

    if (resolvedComponentType && COMPONENT_TYPE_OVERRIDES[resolvedComponentType]) {
      const override = COMPONENT_TYPE_OVERRIDES[resolvedComponentType];
      if (override.length > 0) {
        componentTypes = override;
      }
    }
    const typePlaceholders = componentTypes.map(() => "?").join(",");

    // Find best sort key from the mapped types
    const sortKey = componentTypes.map(t => STAT_SORT_KEY[t]).find(Boolean) || "vc.name";

    // Fetch all compatible components (version-aware)
    const components = await db
      .prepare(
        `SELECT vc.id, vc.uuid, vc.name, vc.slug, vc.class_name, vc.type, vc.sub_type,
                vc.size, vc.grade, vc.class,
                vc.power_output, vc.overpower_performance, vc.overclock_performance,
                vc.thermal_output, vc.cooling_rate, vc.max_temperature,
                vc.shield_hp, vc.shield_regen, vc.resist_physical, vc.resist_energy,
                vc.resist_distortion, vc.resist_thermal, vc.regen_delay, vc.downed_regen_delay,
                vc.quantum_speed, vc.quantum_range, vc.fuel_rate, vc.spool_time,
                vc.cooldown_time, vc.stage1_accel, vc.stage2_accel,
                vc.rounds_per_minute, vc.ammo_container_size, vc.damage_per_shot,
                vc.damage_type, vc.projectile_speed, vc.effective_range, vc.dps,
                vc.damage_physical, vc.damage_energy, vc.damage_distortion, vc.damage_thermal,
                vc.heat_per_shot, vc.power_draw, vc.fire_modes,
                vc.radar_range, vc.radar_angle,
                vc.qed_range, vc.qed_strength,
                vc.ammo_count, vc.missile_type, vc.lock_time, vc.tracking_signal,
                vc.damage, vc.blast_radius, vc.speed, vc.lock_range,
                m.name AS manufacturer_name, m.code AS manufacturer_code
         FROM vehicle_components vc
         ${deltaVersionJoin('vehicle_components', 'vc', 'uuid', versionId)}
         LEFT JOIN manufacturers m ON m.id = vc.manufacturer_id
         WHERE vc.type IN (${typePlaceholders})
           ${resolvedSizeMin === 0 && resolvedSizeMax === 0 ? "" : "AND vc.size BETWEEN ? AND ?"}
         ORDER BY ${sortKey} DESC NULLS LAST, vc.name`,
      )
      .bind(...componentTypes, ...(resolvedSizeMin === 0 && resolvedSizeMax === 0 ? [] : [resolvedSizeMin, resolvedSizeMax]))
      .all();

    // Fetch shop availability via loot_map → loot_item_locations (source_type='shop')
    const classNames = components.results.map((c: any) => c.class_name).filter(Boolean);
    const componentUuids = components.results.map((c: any) => c.uuid).filter(Boolean);
    let shopMap: Record<string, Array<{ location_key: string; buy_price: number | null }>> = {};

    if (classNames.length > 0) {
      const shopRows = await batchInQuery<any>(
        db,
        classNames,
        (ph) =>
          `SELECT lm.class_name, lil.location_key, lil.buy_price
           FROM loot_item_locations lil
           JOIN loot_map lm ON lm.id = lil.loot_map_id
           WHERE lil.source_type = 'shop' AND lil.buy_price > 0
             AND lm.class_name IN (${ph})`,
      );

      for (const row of shopRows) {
        if (!shopMap[row.class_name]) shopMap[row.class_name] = [];
        shopMap[row.class_name].push({
          location_key: row.location_key,
          buy_price: row.buy_price,
        });
      }
    }

    // Check user collection + fleet cross-ref (auth optional)
    let collectionSet = new Set<string>();
    let fleetMap: Record<string, Array<{ fleet_id: number; ship_name: string; custom_name: string | null }>> = {};

    try {
      const user = getAuthUser(c);
      if (user?.id) {
        // Loot collection cross-ref via class_name
        const classNames = components.results.map((c: any) => c.class_name).filter(Boolean);
        if (classNames.length > 0) {
          const collRows = await batchInQuery<any>(
            db,
            classNames,
            (ph) =>
              `SELECT DISTINCT lm.class_name
               FROM user_loot_collection ulc
               JOIN loot_map lm ON lm.id = ulc.loot_item_id
               WHERE ulc.user_id = ? AND lm.class_name IN (${ph})`,
            [user.id],
          );
          for (const row of collRows) {
            collectionSet.add(row.class_name);
          }
        }

        // Fleet cross-ref: which of user's ships have these components equipped
        if (componentUuids.length > 0) {
          const fleetRows = await batchInQuery<any>(
            db,
            componentUuids,
            (ph) =>
              `SELECT vp.equipped_item_uuid, uf.id AS fleet_id,
                      uf.custom_name, v.name AS ship_name
               FROM user_fleet uf
               JOIN vehicles v ON v.id = uf.vehicle_id
               JOIN vehicle_ports vp ON vp.vehicle_id = v.id
               WHERE uf.user_id = ?
                 AND vp.equipped_item_uuid IN (${ph})`,
            [user.id],
          );
          for (const row of fleetRows) {
            if (!fleetMap[row.equipped_item_uuid]) fleetMap[row.equipped_item_uuid] = [];
            // Deduplicate by fleet_id
            if (!fleetMap[row.equipped_item_uuid].some((f: any) => f.fleet_id === row.fleet_id)) {
              fleetMap[row.equipped_item_uuid].push({
                fleet_id: row.fleet_id,
                ship_name: row.ship_name,
                custom_name: row.custom_name,
              });
            }
          }
        }
      }
    } catch {
      // Not authenticated — skip collection/fleet data
    }

    // Resolve the actual stock component UUID by walking the port tree.
    // For turret-housed weapons, port.equipped_item_uuid points to the housing (TurretBase),
    // not the actual weapon. Walk down: port → child → grandchild to find the deepest equipped UUID.
    let stockUuid = port.equipped_item_uuid;
    if (stockUuid) {
      const deepest = await db
        .prepare(
          `SELECT COALESCE(grandchild.equipped_item_uuid, child.equipped_item_uuid, p.equipped_item_uuid) AS deep_uuid
           FROM vehicle_ports p
           LEFT JOIN vehicle_ports child ON child.parent_port_id = p.id AND child.game_version_id = p.game_version_id
           LEFT JOIN vehicle_ports grandchild ON grandchild.parent_port_id = child.id AND grandchild.game_version_id = child.game_version_id
           WHERE p.id = ?
           ORDER BY CASE WHEN grandchild.equipped_item_uuid IS NOT NULL THEN 0
                         WHEN child.equipped_item_uuid IS NOT NULL THEN 1 ELSE 2 END
           LIMIT 1`,
        )
        .bind(portId)
        .first<{ deep_uuid: string | null }>();
      if (deepest?.deep_uuid) stockUuid = deepest.deep_uuid;
    }

    // Merge shop + collection + fleet data into components
    const enriched = components.results.map((comp: any) => ({
      ...comp,
      is_stock: comp.uuid === stockUuid,
      shops: shopMap[comp.class_name] || [],
      in_collection: collectionSet.has(comp.class_name),
      on_ships: fleetMap[comp.uuid] || [],
    }));

    return c.json({
      port_id: portId,
      port_type: port.port_type,
      size_min: resolvedSizeMin,
      size_max: resolvedSizeMax,
      stock_uuid: stockUuid,
      components: enriched,
    });
  });

  // ============================================================
  //  AUTH — Fleet loadout overrides
  // ============================================================

  // GET /api/loadout/fleet/:id — get custom loadout for a fleet ship
  app.get("/fleet/:id", async (c) => {
    const user = getAuthUser(c);
    const fleetId = parseInt(c.req.param("id"), 10);
    if (isNaN(fleetId)) return c.json({ error: "Invalid fleet ID" }, 400);

    const overrides = await c.env.DB
      .prepare(
        `SELECT ufl.id, ufl.port_id, ufl.component_id,
                vc.name AS component_name, vc.uuid AS component_uuid,
                vc.type, vc.sub_type, vc.size, vc.grade, vc.class,
                vc.power_output, vc.cooling_rate, vc.shield_hp, vc.shield_regen,
                vc.resist_physical, vc.resist_energy, vc.resist_distortion,
                vc.quantum_speed, vc.quantum_range, vc.fuel_rate, vc.spool_time,
                vc.dps, vc.damage_per_shot, vc.rounds_per_minute, vc.effective_range,
                vc.radar_range, vc.power_draw, vc.thermal_output,
                m.name AS manufacturer_name
         FROM user_fleet_loadout ufl
         JOIN vehicle_components vc ON vc.id = ufl.component_id
         LEFT JOIN manufacturers m ON m.id = vc.manufacturer_id
         WHERE ufl.user_id = ? AND ufl.user_fleet_id = ?`,
      )
      .bind(user.id, fleetId)
      .all();

    return c.json({ overrides: overrides.results });
  });

  // PUT /api/loadout/fleet/:id — save loadout overrides (bulk)
  app.put("/fleet/:id",
    validate("json", LoadoutBody),
    async (c) => {
      const user = getAuthUser(c);
      const fleetId = parseInt(c.req.param("id"), 10);
      if (isNaN(fleetId)) return c.json({ error: "Invalid fleet ID" }, 400);

      // Verify user owns this fleet entry
      const fleetEntry = await c.env.DB
        .prepare("SELECT id FROM user_fleet WHERE id = ? AND user_id = ?")
        .bind(fleetId, user.id)
        .first();
      if (!fleetEntry) return c.json({ error: "Fleet entry not found" }, 404);

      const { overrides } = c.req.valid("json");
      const db = c.env.DB;

      // Upsert each override
      const stmts = overrides.map((o) =>
        db
          .prepare(
            `INSERT INTO user_fleet_loadout (user_id, user_fleet_id, port_id, component_id, updated_at)
             VALUES (?, ?, ?, ?, datetime('now'))
             ON CONFLICT (user_id, user_fleet_id, port_id)
             DO UPDATE SET component_id = excluded.component_id, updated_at = datetime('now')`,
          )
          .bind(user.id, fleetId, o.port_id, o.component_id),
      );

      if (stmts.length > 0) {
        await db.batch(stmts);
      }

      return c.json({ ok: true });
    },
  );

  // DELETE /api/loadout/fleet/:id — reset entire ship to stock
  app.delete("/fleet/:id", async (c) => {
    const user = getAuthUser(c);
    const fleetId = parseInt(c.req.param("id"), 10);
    if (isNaN(fleetId)) return c.json({ error: "Invalid fleet ID" }, 400);

    await c.env.DB
      .prepare("DELETE FROM user_fleet_loadout WHERE user_id = ? AND user_fleet_id = ?")
      .bind(user.id, fleetId)
      .run();

    return c.json({ ok: true });
  });

  // DELETE /api/loadout/fleet/:id/port/:portId — reset single port to stock
  app.delete("/fleet/:id/port/:portId", async (c) => {
    const user = getAuthUser(c);
    const fleetId = parseInt(c.req.param("id"), 10);
    const portId = parseInt(c.req.param("portId"), 10);
    if (isNaN(fleetId) || isNaN(portId)) return c.json({ error: "Invalid IDs" }, 400);

    await c.env.DB
      .prepare("DELETE FROM user_fleet_loadout WHERE user_id = ? AND user_fleet_id = ? AND port_id = ?")
      .bind(user.id, fleetId, portId)
      .run();

    return c.json({ ok: true });
  });

  // ============================================================
  //  AUTH — Shopping cart
  // ============================================================

  // GET /api/loadout/cart — user's shopping cart
  app.get("/cart", async (c) => {
    const user = getAuthUser(c);
    const rows = await c.env.DB
      .prepare(
        `SELECT ulc.id, ulc.component_id, ulc.shop_id, ulc.quantity, ulc.source_fleet_id,
                vc.name AS component_name, vc.uuid AS component_uuid, vc.class_name, vc.type, vc.size, vc.grade,
                m.name AS manufacturer_name,
                cheapest.location_key AS shop_name,
                cheapest.buy_price,
                uf.custom_name AS fleet_custom_name,
                v.name AS fleet_ship_name
         FROM user_loadout_cart ulc
         JOIN vehicle_components vc ON vc.id = ulc.component_id
         LEFT JOIN manufacturers m ON m.id = vc.manufacturer_id
         LEFT JOIN (
           SELECT lm.class_name, lil.location_key, lil.buy_price,
                  ROW_NUMBER() OVER (PARTITION BY lm.class_name ORDER BY lil.buy_price ASC) AS rn
           FROM loot_item_locations lil
           JOIN loot_map lm ON lm.id = lil.loot_map_id
           WHERE lil.source_type = 'shop' AND lil.buy_price > 0
         ) cheapest ON cheapest.class_name = vc.class_name AND cheapest.rn = 1
         LEFT JOIN user_fleet uf ON uf.id = ulc.source_fleet_id
         LEFT JOIN vehicles v ON v.id = uf.vehicle_id
         WHERE ulc.user_id = ?
         ORDER BY vc.type, vc.name`,
      )
      .bind(user.id)
      .all();

    return c.json({ items: rows.results });
  });

  // POST /api/loadout/cart — add items to cart
  app.post("/cart",
    validate("json", CartAddBody),
    async (c) => {
      const user = getAuthUser(c);
      const { items } = c.req.valid("json");
      const db = c.env.DB;

      const stmts = items.map((item) =>
        db
          .prepare(
            `INSERT INTO user_loadout_cart (user_id, component_id, shop_id, source_fleet_id, quantity)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (user_id, component_id, source_fleet_id)
             DO UPDATE SET quantity = user_loadout_cart.quantity + excluded.quantity,
                           shop_id = COALESCE(excluded.shop_id, user_loadout_cart.shop_id)`,
          )
          .bind(user.id, item.component_id, item.shop_id ?? null, item.source_fleet_id ?? null, item.quantity),
      );

      if (stmts.length > 0) {
        await db.batch(stmts);
      }

      return c.json({ ok: true });
    },
  );

  // PUT /api/loadout/cart/:id — update cart item
  app.put("/cart/:id",
    validate("json", CartUpdateBody),
    async (c) => {
      const user = getAuthUser(c);
      const cartId = parseInt(c.req.param("id"), 10);
      if (isNaN(cartId)) return c.json({ error: "Invalid cart ID" }, 400);

      const body = c.req.valid("json");
      const updates: string[] = [];
      const values: unknown[] = [];

      if (body.shop_id !== undefined) {
        updates.push("shop_id = ?");
        values.push(body.shop_id);
      }
      if (body.quantity !== undefined) {
        updates.push("quantity = ?");
        values.push(body.quantity);
      }

      if (updates.length === 0) return c.json({ error: "No fields to update" }, 400);

      values.push(cartId, user.id);
      await c.env.DB
        .prepare(`UPDATE user_loadout_cart SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`)
        .bind(...values)
        .run();

      return c.json({ ok: true });
    },
  );

  // DELETE /api/loadout/cart/:id — remove single cart item
  app.delete("/cart/:id", async (c) => {
    const user = getAuthUser(c);
    const cartId = parseInt(c.req.param("id"), 10);
    if (isNaN(cartId)) return c.json({ error: "Invalid cart ID" }, 400);

    await c.env.DB
      .prepare("DELETE FROM user_loadout_cart WHERE id = ? AND user_id = ?")
      .bind(cartId, user.id)
      .run();

    return c.json({ ok: true });
  });

  // DELETE /api/loadout/cart — empty entire cart
  app.delete("/cart", async (c) => {
    const user = getAuthUser(c);
    await c.env.DB
      .prepare("DELETE FROM user_loadout_cart WHERE user_id = ?")
      .bind(user.id)
      .run();

    return c.json({ ok: true });
  });

  // POST /api/loadout/cart/optimize — assign optimal shops (minimum shops algorithm)
  app.post("/cart/optimize", async (c) => {
    const user = getAuthUser(c);
    const db = c.env.DB;
    const patch = c.req.query("patch");
    const versionId = await resolveVersionId(db, patch);
    const vq = versionSubquery(versionId);

    // Get all cart items
    const cartItems = await db
      .prepare(
        `SELECT ulc.id, vc.uuid AS component_uuid
         FROM user_loadout_cart ulc
         JOIN vehicle_components vc ON vc.id = ulc.component_id
         WHERE ulc.user_id = ?`,
      )
      .bind(user.id)
      .all();

    if (cartItems.results.length === 0) return c.json({ ok: true, message: "Cart is empty" });

    // Get all shops that sell any cart item
    const uuids = cartItems.results.map((r: any) => r.component_uuid).filter(Boolean);

    const shopAvailRows = await batchInQuery<any>(
      db,
      uuids,
      (ph) =>
        `SELECT si.item_uuid, s.id AS shop_id
         FROM shop_inventory si
         JOIN shops s ON s.id = si.shop_id
         ${deltaVersionJoin('shops', 's', 'uuid', versionId)}
         WHERE si.item_uuid IN (${ph})
           AND si.buy_price IS NOT NULL
           AND si.game_version_id <= ${vq}`,
    );
    const shopAvail = { results: shopAvailRows };

    // Build shop → items map
    const shopToItems: Record<number, Set<string>> = {};
    const itemToShops: Record<string, Set<number>> = {};
    for (const row of shopAvail.results as any[]) {
      if (!shopToItems[row.shop_id]) shopToItems[row.shop_id] = new Set();
      shopToItems[row.shop_id].add(row.item_uuid);
      if (!itemToShops[row.item_uuid]) itemToShops[row.item_uuid] = new Set();
      itemToShops[row.item_uuid].add(row.shop_id);
    }

    // Greedy set-cover: pick shop covering most uncovered items
    const uncovered = new Set(uuids);
    const assignments: Record<string, number | null> = {};

    while (uncovered.size > 0) {
      let bestShop: number | null = null;
      let bestCount = 0;

      for (const [shopIdStr, items] of Object.entries(shopToItems)) {
        const shopId = parseInt(shopIdStr, 10);
        let count = 0;
        for (const item of items) {
          if (uncovered.has(item)) count++;
        }
        if (count > bestCount) {
          bestCount = count;
          bestShop = shopId;
        }
      }

      if (bestShop === null) {
        // Remaining items have no shops — mark as loot-only
        for (const uuid of uncovered) {
          assignments[uuid] = null;
        }
        break;
      }

      // Assign this shop to all items it covers
      for (const item of shopToItems[bestShop]) {
        if (uncovered.has(item)) {
          assignments[item] = bestShop;
          uncovered.delete(item);
        }
      }
    }

    // Update cart items with assigned shops
    const updateStmts = cartItems.results.map((item: any) => {
      const shopId = assignments[item.component_uuid] ?? null;
      return db
        .prepare("UPDATE user_loadout_cart SET shop_id = ? WHERE id = ?")
        .bind(shopId, item.id);
    });

    if (updateStmts.length > 0) {
      await db.batch(updateStmts);
    }

    return c.json({ ok: true });
  });

  return app;
}
