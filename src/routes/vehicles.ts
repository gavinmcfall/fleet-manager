import { Hono } from "hono";
import type { Env } from "../lib/types";
import { vehicleVersionJoin } from "../lib/constants";
import { cachedJson, resolveVersionId, cacheSlug } from "../lib/cache";

/**
 * /api/ships/* — Ship reference database (all vehicles in the game)
 */
export function vehicleRoutes<E extends { Bindings: Env }>() {
  const routes = new Hono<E>();

  // GET /api/ships — list all vehicles
  routes.get("/", async (c) => {
    const db = c.env.DB;
    const patch = c.req.query("patch");
    const versionId = await resolveVersionId(db, patch);
    return cachedJson(c,`ships:list:${versionId}`, async () => {
      const result = await db
        .prepare(
          `SELECT v.id, v.uuid, v.slug, v.name, v.class_name,
            v.size, v.size_label, v.focus, v.classification, v.description,
            v.length, v.beam, v.height, v.mass, v.cargo,
            v.crew_min, v.crew_max, v.speed_scm, v.pledge_price, v.on_sale,
            v.image_url, v.image_url_small, v.image_url_medium, v.image_url_large,
            v.pledge_url, v.price_auec, v.acquisition_type, v.acquisition_source_name,
            m.name as manufacturer_name, m.code as manufacturer_code,
            CASE WHEN v.parent_vehicle_id IS NOT NULL AND pps.key IS NOT NULL
              THEN pps.key ELSE ps.key END as production_status
          FROM vehicles v
          ${vehicleVersionJoin(versionId)}
          LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
          LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
          LEFT JOIN vehicles pv ON pv.id = v.parent_vehicle_id
          LEFT JOIN production_statuses pps ON pps.id = pv.production_status_id
          WHERE v.is_paint_variant = 0 AND v.removed = 0
          ORDER BY v.name`,
        )
        .all();
      return result.results;
    });
  });

  // GET /api/ships/:slug — get single vehicle by slug
  routes.get("/:slug", async (c) => {
    const slug = c.req.param("slug");
    const db = c.env.DB;
    const patch = c.req.query("patch");
    const versionId = await resolveVersionId(db, patch);
    return cachedJson(c,`ships:detail:${versionId}:${cacheSlug(slug)}`, async () => {
      const vehicle = await db
        .prepare(
          `SELECT v.id, v.uuid, v.slug, v.name, v.class_name,
            v.size, v.size_label, v.focus, v.classification, v.description,
            v.length, v.beam, v.height, v.mass, v.cargo,
            v.crew_min, v.crew_max, v.speed_scm, v.speed_max, v.health,
            v.vehicle_inventory, v.pledge_price, v.on_sale,
            v.image_url, v.image_url_small, v.image_url_medium, v.image_url_large,
            v.pledge_url, v.price_auec, v.acquisition_type, v.acquisition_source_name,
            v.boost_speed_back, v.angular_velocity_pitch, v.angular_velocity_yaw,
            v.angular_velocity_roll, v.fuel_capacity_hydrogen, v.fuel_capacity_quantum,
            v.thruster_count_main, v.thruster_count_maneuvering,
            v.armor_hp, v.armor_damage_physical, v.armor_damage_energy,
            v.armor_damage_distortion, v.armor_damage_thermal,
            v.armor_deflection_physical, v.armor_deflection_energy,
            v.armor_signal_ir, v.armor_signal_em, v.armor_signal_cs,
            v.weapon_pool_size, v.shield_pool_max,
            v.cross_section_x, v.cross_section_y, v.cross_section_z,
            m.name as manufacturer_name, m.code as manufacturer_code,
            CASE WHEN v.parent_vehicle_id IS NOT NULL AND pps.key IS NOT NULL
              THEN pps.key ELSE ps.key END as production_status
          FROM vehicles v
          ${vehicleVersionJoin(versionId)}
          LEFT JOIN manufacturers m ON m.id = v.manufacturer_id
          LEFT JOIN production_statuses ps ON ps.id = v.production_status_id
          LEFT JOIN vehicles pv ON pv.id = v.parent_vehicle_id
          LEFT JOIN production_statuses pps ON pps.id = pv.production_status_id
          WHERE v.slug = ? AND v.is_paint_variant = 0`,
        )
        .bind(slug)
        .first();
      return vehicle;
    });
  });

  return routes;
}
