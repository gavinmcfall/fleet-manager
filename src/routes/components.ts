import { Hono } from "hono";
import type { HonoEnv } from "../lib/types";
import { PORT_TYPE_TO_COMPONENT_TYPE, STAT_SORT_KEY } from "../lib/constants";
import { cachedJson } from "../lib/cache";

// Valid URL slugs → port_type keys used in PORT_TYPE_TO_COMPONENT_TYPE
const VALID_TYPES = new Set([
  "weapon", "shield", "cooler", "power", "quantum_drive",
  "sensor", "turret", "missile", "mining_laser", "salvage_head", "qed",
]);

/**
 * /api/components/:type — Public reference data for all ship components by type.
 * No auth required. KV-cached per type.
 */
export function componentRoutes() {
  const app = new Hono<HonoEnv>();

  app.get("/:type", async (c) => {
    const type = c.req.param("type");
    if (!VALID_TYPES.has(type)) {
      return c.json({ error: `Invalid component type. Valid: ${[...VALID_TYPES].join(", ")}` }, 400);
    }

    const db = c.env.DB;

    return cachedJson(c, `components:${type}`, async () => {
      const componentTypes = PORT_TYPE_TO_COMPONENT_TYPE[type] || [type];
      const typePlaceholders = componentTypes.map(() => "?").join(",");
      const sortKey = componentTypes.map(t => STAT_SORT_KEY[t]).find(Boolean) || "vc.name";

      const rows = await db
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
                  vc.em_signature, vc.mass, vc.hp, vc.overheat_temperature,
                  vc.base_heat_generation, vc.distortion_max,
                  m.name AS manufacturer_name, m.code AS manufacturer_code
           FROM vehicle_components vc
           LEFT JOIN manufacturers m ON m.id = vc.manufacturer_id
           WHERE vc.type IN (${typePlaceholders})
             AND vc.name NOT LIKE '%Template%'
           ORDER BY ${sortKey} DESC NULLS LAST, vc.name`,
        )
        .bind(...componentTypes)
        .all();

      return { type, components: rows.results };
    });
  });

  return app;
}
