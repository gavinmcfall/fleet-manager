/**
 * PTU shadow table infrastructure.
 *
 * PTU data lives in `ptu_*` prefix tables in the same DB as live data.
 * Hard purge on PTU end = DROP TABLE IF EXISTS ptu_*.
 * Query routing: isPTU ? `ptu_vehicles` : `vehicles`.
 */

import type { Context, MiddlewareHandler } from "hono";
import type { HonoEnv } from "./types";

/**
 * All 86 versioned game-data tables, in FK-safe deletion order
 * (children before parents). Used for PTU table creation and purge.
 */
export const VERSIONED_TABLES = [
  // Vehicle children → vehicles → manufacturers
  "vehicle_weapon_racks", "vehicle_suit_lockers", "vehicle_ports",
  "vehicle_modules", "vehicle_roles", "vehicle_careers",
  "salvageable_ships",
  // Loot children → loot_map → FPS/vehicle tables
  "loot_item_locations", "loot_map",
  "vehicle_components",
  // Component subtables
  "component_coolers", "component_mining", "component_missiles",
  "component_powerplants", "component_qed", "component_quantum_drives",
  "component_radar", "component_shields", "component_thrusters",
  "component_turrets", "component_weapons",
  // Shop children → shops
  "shop_locations", "shop_franchises",
  "terminal_inventory", "terminals",
  // Mission children → missions → mission_givers
  "mission_prerequisites", "mission_reputation_requirements",
  "missions", "mission_givers", "mission_types", "mission_organizations",
  "star_map_locations", "star_systems",
  "ship_missiles",
  // Reputation children → reputation_scopes → factions
  "reputation_perks", "reputation_standings",
  "faction_reputation_scopes", "reputation_scopes", "reputation_reward_tiers",
  // NPC children
  "npc_loadout_items", "npc_loadouts",
  // Mining
  "rock_compositions", "mining_quality_distributions", "mining_modules",
  "mining_locations", "mining_lasers", "mining_gadgets",
  "mining_clustering_presets", "mineable_elements",
  // FPS tables → manufacturers
  "fps_weapons", "fps_utilities", "fps_melee", "fps_helmets",
  "fps_clothing", "fps_attachments", "fps_armour",
  "fps_ammo_types", "fps_carryables",
  "consumable_effects", "consumable_effect_types", "consumables",
  // Contract system
  "contract_generator_blueprint_pools", "contract_generator_careers",
  "contract_generator_contracts", "contract_generators",
  "contract_blueprint_reward_pools", "contracts",
  // Crafting
  "crafting_blueprint_reward_pools", "crafting_resources", "crafting_blueprints",
  // Reference tables
  "armor_resistance_profiles",
  "jurisdiction_infraction_overrides", "law_jurisdictions", "law_infractions",
  "harvestables", "props",
  "trade_commodities",
  "refining_processes",
  "damage_types", "factions",
  "paints", "shops",
  // Root parents (delete last)
  "vehicles", "manufacturers",
] as const;

/** Returns the table name for the given context (live or PTU). */
export function resolveTable(table: string, isPTU: boolean): string {
  return isPTU ? `ptu_${table}` : table;
}

export type Channel = "LIVE" | "PTU" | "EPTU";

const VALID_CHANNELS: ReadonlySet<string> = new Set(["LIVE", "PTU", "EPTU"]);

/** Returns true if the given channel is a PTU/EPTU preview channel. */
export function isPTUChannel(channel: string): boolean {
  return channel === "PTU" || channel === "EPTU";
}

/**
 * Resolve the active channel for a request.
 *
 * Order of precedence:
 *   1. ?channel= query param (case-insensitive) — explicit override
 *   2. Channel computed by `channelMiddleware` and stored on the context
 *      (driven by the authenticated user's adminPreviewPatch setting if
 *      they are a super_admin)
 *   3. Default: LIVE
 *
 * SYNC. The async DB lookup happens once in middleware; routes read the
 * cached value from context.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getActiveChannel(c: Context<any>): Channel {
  const raw = c.req.query("channel");
  if (raw) {
    const upper = raw.toUpperCase();
    if (VALID_CHANNELS.has(upper)) return upper as Channel;
  }
  // Defensive: c.get may not be defined in lightweight test mocks.
  if (typeof c.get === "function") {
    const cached = c.get("channel") as Channel | undefined;
    if (cached) return cached;
  }
  return "LIVE";
}

/**
 * Map an `adminPreviewPatch` patch code to a channel.
 *
 * Convention (per `reference_ptu_strategy.md`): PTU/EPTU game_versions
 * rows use stable codes ending in `-ptu` or `-eptu`. LIVE rows end
 * in `-live`. Unknown shapes fall back to LIVE.
 */
function patchToChannel(patchCode: string | null | undefined): Channel {
  if (!patchCode) return "LIVE";
  const lower = patchCode.toLowerCase();
  if (lower.endsWith("-eptu")) return "EPTU";
  if (lower.endsWith("-ptu")) return "PTU";
  return "LIVE";
}

/**
 * Middleware that resolves the active channel for the request and stashes
 * it on the context as `channel`. Routes downstream read it via
 * `getActiveChannel(c)`.
 *
 * Resolution sources (first match wins):
 *   1. `?channel=` query param — applies to ANY caller (dev + smoke testing)
 *   2. Authenticated user's `adminPreviewPatch` user_settings row
 *      (super_admin only — non-admin rows are ignored even if set somehow)
 *   3. Default: LIVE
 *
 * Runs after auth so `c.get("user")` is populated. Only adds one DB query
 * per request when the user is logged in AND has the setting; non-admin
 * users skip the query path entirely.
 */
export const channelMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const raw = c.req.query("channel");
  if (raw) {
    const upper = raw.toUpperCase();
    if (VALID_CHANNELS.has(upper)) {
      c.set("channel", upper as Channel);
      await next();
      return;
    }
  }

  const user = c.get("user");
  if (user?.role === "super_admin") {
    try {
      const row = await c.env.DB
        .prepare(
          "SELECT value FROM user_settings WHERE user_id = ? AND key = 'adminPreviewPatch' LIMIT 1",
        )
        .bind(user.id)
        .first<{ value: string }>();
      if (row?.value) {
        c.set("channel", patchToChannel(row.value));
        await next();
        return;
      }
    } catch {
      // DB hiccup — fall through to LIVE rather than error the request.
    }
  }

  c.set("channel", "LIVE");
  await next();
};
