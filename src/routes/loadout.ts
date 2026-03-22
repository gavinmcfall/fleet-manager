import { Hono } from "hono";
import { z } from "zod";
import { getAuthUser, type HonoEnv } from "../lib/types";
import { validate } from "../lib/validation";
import { versionSubquery } from "../lib/constants";
import { cachedJson, resolveVersionId, cacheSlug } from "../lib/cache";
import { getShipLoadout } from "../db/queries";

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
      return getShipLoadout(c.env.DB, slug, patch);
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

    const vq = versionSubquery(patch);

    // Get port info (type + size range)
    const port = await db
      .prepare(
        `SELECT vp.port_type, vp.size_min, vp.size_max, vp.equipped_item_uuid
         FROM vehicle_ports vp
         INNER JOIN (
           SELECT uuid, MAX(game_version_id) as latest_gv
           FROM vehicle_ports WHERE game_version_id <= ${vq}
           GROUP BY uuid
         ) _pvv ON vp.uuid = _pvv.uuid AND vp.game_version_id = _pvv.latest_gv
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

    const componentTypes = PORT_TYPE_TO_COMPONENT_TYPE[resolvedPortType] || [resolvedPortType || "UNKNOWN"];
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
                vc.heat_per_shot, vc.power_draw, vc.fire_modes,
                vc.radar_range, vc.radar_angle,
                vc.qed_range, vc.qed_strength,
                vc.ammo_count, vc.missile_type, vc.lock_time, vc.tracking_signal,
                vc.damage, vc.blast_radius, vc.speed, vc.lock_range,
                m.name AS manufacturer_name, m.code AS manufacturer_code
         FROM vehicle_components vc
         INNER JOIN (
           SELECT uuid, MAX(game_version_id) as latest_gv
           FROM vehicle_components
           WHERE game_version_id <= ${vq}
           GROUP BY uuid
         ) _cvv ON vc.uuid = _cvv.uuid AND vc.game_version_id = _cvv.latest_gv
         LEFT JOIN manufacturers m ON m.id = vc.manufacturer_id
         WHERE vc.type IN (${typePlaceholders})
           ${port.size_min === 0 && port.size_max === 0 ? "" : "AND vc.size BETWEEN ? AND ?"}
         ORDER BY ${sortKey} DESC NULLS LAST, vc.name`,
      )
      .bind(...componentTypes, ...(port.size_min === 0 && port.size_max === 0 ? [] : [port.size_min, port.size_max]))
      .all();

    // Fetch shop availability for all compatible components
    const componentUuids = components.results.map((c: any) => c.uuid).filter(Boolean);
    let shopMap: Record<string, Array<{ shop_id: number; shop_name: string; shop_slug: string; location_label: string; buy_price: number | null }>> = {};

    if (componentUuids.length > 0) {
      // Batch query shops — use IN clause with placeholders
      const placeholders = componentUuids.map(() => "?").join(",");
      const shopRows = await db
        .prepare(
          `SELECT si.item_uuid, si.buy_price, s.id AS shop_id, s.name AS shop_name,
                  s.slug AS shop_slug, s.location_label
           FROM shop_inventory si
           JOIN shops s ON s.id = si.shop_id
           INNER JOIN (
             SELECT uuid, MAX(game_version_id) as latest_gv
             FROM shops WHERE game_version_id <= ${vq}
             GROUP BY uuid
           ) _svv ON s.uuid = _svv.uuid AND s.game_version_id = _svv.latest_gv
           WHERE si.item_uuid IN (${placeholders})
             AND si.game_version_id <= ${vq}`,
        )
        .bind(...componentUuids)
        .all();

      for (const row of shopRows.results as any[]) {
        if (!shopMap[row.item_uuid]) shopMap[row.item_uuid] = [];
        shopMap[row.item_uuid].push({
          shop_id: row.shop_id,
          shop_name: row.shop_name,
          shop_slug: row.shop_slug,
          location_label: row.location_label,
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
          const clPlaceholders = classNames.map(() => "?").join(",");
          const collRows = await db
            .prepare(
              `SELECT DISTINCT lm.class_name
               FROM user_loot_collection ulc
               JOIN loot_map lm ON lm.id = ulc.loot_item_id
               WHERE ulc.user_id = ? AND lm.class_name IN (${clPlaceholders})`,
            )
            .bind(user.id, ...classNames)
            .all();
          for (const row of collRows.results as any[]) {
            collectionSet.add(row.class_name);
          }
        }

        // Fleet cross-ref: which of user's ships have these components equipped
        if (componentUuids.length > 0) {
          const fPlaceholders = componentUuids.map(() => "?").join(",");
          const fleetRows = await db
            .prepare(
              `SELECT vp.equipped_item_uuid, uf.id AS fleet_id,
                      uf.custom_name, v.name AS ship_name
               FROM user_fleet uf
               JOIN vehicles v ON v.id = uf.vehicle_id
               JOIN vehicle_ports vp ON vp.vehicle_id = v.id
               WHERE uf.user_id = ?
                 AND vp.equipped_item_uuid IN (${fPlaceholders})`,
            )
            .bind(user.id, ...componentUuids)
            .all();
          for (const row of fleetRows.results as any[]) {
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

    // Merge shop + collection + fleet data into components
    const enriched = components.results.map((comp: any) => ({
      ...comp,
      is_stock: comp.uuid === port.equipped_item_uuid,
      shops: shopMap[comp.uuid] || [],
      in_collection: collectionSet.has(comp.class_name),
      on_ships: fleetMap[comp.uuid] || [],
    }));

    return c.json({
      port_id: portId,
      port_type: port.port_type,
      size_min: port.size_min,
      size_max: port.size_max,
      stock_uuid: port.equipped_item_uuid,
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
                vc.name AS component_name, vc.uuid AS component_uuid, vc.type, vc.size, vc.grade,
                m.name AS manufacturer_name,
                s.name AS shop_name, s.slug AS shop_slug, s.location_label,
                si.buy_price,
                uf.custom_name AS fleet_custom_name,
                v.name AS fleet_ship_name
         FROM user_loadout_cart ulc
         JOIN vehicle_components vc ON vc.id = ulc.component_id
         LEFT JOIN manufacturers m ON m.id = vc.manufacturer_id
         LEFT JOIN shops s ON s.id = ulc.shop_id
         LEFT JOIN shop_inventory si ON si.shop_id = s.id AND si.item_uuid = vc.uuid
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
            `INSERT INTO user_loadout_cart (user_id, component_id, source_fleet_id, quantity)
             VALUES (?, ?, ?, ?)
             ON CONFLICT (user_id, component_id, source_fleet_id)
             DO UPDATE SET quantity = user_loadout_cart.quantity + excluded.quantity`,
          )
          .bind(user.id, item.component_id, item.source_fleet_id ?? null, item.quantity),
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
    const vq = versionSubquery(patch);

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
    const placeholders = uuids.map(() => "?").join(",");

    const shopAvail = await db
      .prepare(
        `SELECT si.item_uuid, s.id AS shop_id
         FROM shop_inventory si
         JOIN shops s ON s.id = si.shop_id
         INNER JOIN (
           SELECT uuid, MAX(game_version_id) as latest_gv
           FROM shops WHERE game_version_id <= ${vq}
           GROUP BY uuid
         ) _svv ON s.uuid = _svv.uuid AND s.game_version_id = _svv.latest_gv
         WHERE si.item_uuid IN (${placeholders})
           AND si.buy_price IS NOT NULL
           AND si.game_version_id <= ${vq}`,
      )
      .bind(...uuids)
      .all();

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
