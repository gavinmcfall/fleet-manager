import { Hono } from "hono";
import { z } from "zod";
import { getAuthUser, type HonoEnv } from "../lib/types";
import { validate } from "../lib/validation";
import { resolveVersionId } from "../lib/cache";
import {
  type AsopEntry,
  type ItemRow,
  type LabelOverride,
  type LocalizationConfig,
  DEFAULT_CONFIG,
  configFromRow,
  generateAsopOverrides,
  generateItemLabels,
  mergeGlobalIni,
} from "../lib/localization";

/**
 * /api/localization/* — Localization Builder endpoints
 */
export function localizationRoutes() {
  const routes = new Hono<HonoEnv>();

  // ── GET /config — user's localization preferences ──────────────────

  routes.get("/config", async (c) => {
    const db = c.env.DB;
    const userId = getAuthUser(c).id;

    const row = await db
      .prepare("SELECT * FROM user_localization_configs WHERE user_id = ?")
      .bind(userId)
      .first();

    return c.json(row ? configFromRow(row) : DEFAULT_CONFIG);
  });

  // ── PUT /config — save preferences ────────────────────────────────

  routes.put(
    "/config",
    validate(
      "json",
      z.object({
        asopEnabled: z.boolean().optional(),
        labelsVehicleComponents: z.boolean().optional(),
        labelsFpsWeapons: z.boolean().optional(),
        labelsFpsArmour: z.boolean().optional(),
        labelsFpsHelmets: z.boolean().optional(),
        labelsFpsAttachments: z.boolean().optional(),
        labelsFpsUtilities: z.boolean().optional(),
        labelsConsumables: z.boolean().optional(),
        labelsShipMissiles: z.boolean().optional(),
        labelFormat: z.enum(["suffix", "prefix"]).optional(),
      }),
    ),
    async (c) => {
      const db = c.env.DB;
      const userId = getAuthUser(c).id;
      const body = c.req.valid("json");

      await db
        .prepare(
          `INSERT INTO user_localization_configs (
            user_id, asop_enabled,
            labels_vehicle_components, labels_fps_weapons, labels_fps_armour,
            labels_fps_helmets, labels_fps_attachments, labels_fps_utilities,
            labels_consumables, labels_ship_missiles, label_format, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET
            asop_enabled = excluded.asop_enabled,
            labels_vehicle_components = excluded.labels_vehicle_components,
            labels_fps_weapons = excluded.labels_fps_weapons,
            labels_fps_armour = excluded.labels_fps_armour,
            labels_fps_helmets = excluded.labels_fps_helmets,
            labels_fps_attachments = excluded.labels_fps_attachments,
            labels_fps_utilities = excluded.labels_fps_utilities,
            labels_consumables = excluded.labels_consumables,
            labels_ship_missiles = excluded.labels_ship_missiles,
            label_format = excluded.label_format,
            updated_at = excluded.updated_at`,
        )
        .bind(
          userId,
          body.asopEnabled ? 1 : 0,
          body.labelsVehicleComponents ? 1 : 0,
          body.labelsFpsWeapons ? 1 : 0,
          body.labelsFpsArmour ? 1 : 0,
          body.labelsFpsHelmets ? 1 : 0,
          body.labelsFpsAttachments ? 1 : 0,
          body.labelsFpsUtilities ? 1 : 0,
          body.labelsConsumables ? 1 : 0,
          body.labelsShipMissiles ? 1 : 0,
          body.labelFormat ?? "suffix",
        )
        .run();

      return c.json({ ok: true });
    },
  );

  // ── GET /ship-order — user's ASOP ordering ────────────────────────

  routes.get("/ship-order", async (c) => {
    const db = c.env.DB;
    const userId = getAuthUser(c).id;

    const rows = await db
      .prepare(
        `SELECT o.vehicle_id, o.sort_position, o.custom_label, v.name as vehicle_name, v.class_name
         FROM user_localization_ship_order o
         JOIN vehicles v ON v.id = o.vehicle_id
         WHERE o.user_id = ?
         ORDER BY o.sort_position`,
      )
      .bind(userId)
      .all();

    return c.json({ items: rows.results });
  });

  // ── PUT /ship-order — save ASOP ordering ──────────────────────────

  routes.put(
    "/ship-order",
    validate(
      "json",
      z.object({
        items: z
          .array(
            z.object({
              vehicleId: z.number().int().positive(),
              sortPosition: z.number().int().positive(),
              customLabel: z.string().max(100).nullable().optional(),
            }),
          )
          .max(500),
      }),
    ),
    async (c) => {
      const db = c.env.DB;
      const userId = getAuthUser(c).id;
      const { items } = c.req.valid("json");

      // Full replace: delete then insert
      const stmts: D1PreparedStatement[] = [
        db
          .prepare("DELETE FROM user_localization_ship_order WHERE user_id = ?")
          .bind(userId),
      ];

      for (const item of items) {
        stmts.push(
          db
            .prepare(
              `INSERT INTO user_localization_ship_order (user_id, vehicle_id, sort_position, custom_label)
               VALUES (?, ?, ?, ?)`,
            )
            .bind(userId, item.vehicleId, item.sortPosition, item.customLabel ?? null),
        );
      }

      await db.batch(stmts);
      return c.json({ ok: true });
    },
  );

  // ── GET /preview — preview override key/value pairs ───────────────

  routes.get("/preview", async (c) => {
    const db = c.env.DB;
    const userId = getAuthUser(c).id;

    const configRow = await db
      .prepare("SELECT * FROM user_localization_configs WHERE user_id = ?")
      .bind(userId)
      .first();

    const config: LocalizationConfig = configRow
      ? configFromRow(configRow)
      : DEFAULT_CONFIG;

    const overrides = await buildOverrides(db, userId, config);

    return c.json({
      config,
      overrides: overrides.map((o) => ({
        key: o.key,
        value: o.value,
        original: o.original,
      })),
      count: overrides.length,
    });
  });

  // ── GET /download — generate and download merged global.ini ───────

  routes.get("/download", async (c) => {
    const db = c.env.DB;
    const kv = c.env.SC_BRIDGE_CACHE;
    const userId = getAuthUser(c).id;

    // Get default game version code
    const ver = await db
      .prepare("SELECT code FROM game_versions WHERE is_default = 1 LIMIT 1")
      .first<{ code: string }>();
    if (!ver) {
      return c.json({ error: "No default game version configured" }, 500);
    }

    // Read base global.ini from KV
    const baseContent = await kv.get(`localization:global-ini:${ver.code}`);
    if (!baseContent) {
      return c.json(
        { error: "Base localization file not available for this version" },
        404,
      );
    }

    // Build overrides from user config
    const configRow = await db
      .prepare("SELECT * FROM user_localization_configs WHERE user_id = ?")
      .bind(userId)
      .first();

    const config: LocalizationConfig = configRow
      ? configFromRow(configRow)
      : DEFAULT_CONFIG;

    const overrideList = await buildOverrides(db, userId, config);

    // Build override map
    const overrideMap = new Map<string, string>();
    for (const o of overrideList) {
      overrideMap.set(o.key, o.value);
    }

    // Merge
    const merged = mergeGlobalIni(baseContent, overrideMap);

    // Return as downloadable file
    return new Response(merged, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="global.ini"`,
        "Cache-Control": "no-store",
      },
    });
  });

  return routes;
}

// ---------------------------------------------------------------------------
// Shared: build all overrides from config + DB data
// ---------------------------------------------------------------------------

async function buildOverrides(
  db: D1Database,
  userId: string,
  config: LocalizationConfig,
): Promise<LabelOverride[]> {
  const versionId = await resolveVersionId(db);
  const overrides: LabelOverride[] = [];

  // ASOP ordering
  if (config.asopEnabled) {
    const rows = await db
      .prepare(
        `SELECT o.vehicle_id, o.sort_position, o.custom_label, v.name as vehicle_name, v.class_name
         FROM user_localization_ship_order o
         JOIN vehicles v ON v.id = o.vehicle_id
         WHERE o.user_id = ?
         ORDER BY o.sort_position`,
      )
      .bind(userId)
      .all<{
        vehicle_id: number;
        sort_position: number;
        custom_label: string | null;
        vehicle_name: string;
        class_name: string;
      }>();

    const entries: AsopEntry[] = rows.results.map((r) => ({
      vehicleId: r.vehicle_id,
      className: r.class_name,
      vehicleName: r.vehicle_name,
      sortPosition: r.sort_position,
      customLabel: r.custom_label,
    }));

    overrides.push(...generateAsopOverrides(entries));
  }

  // Item labels — query each enabled category
  const categoryQueries: Array<{
    enabled: boolean;
    table: string;
    hasGrade: boolean;
  }> = [
    { enabled: config.labelsVehicleComponents, table: "vehicle_components", hasGrade: true },
    { enabled: config.labelsFpsWeapons, table: "fps_weapons", hasGrade: false },
    { enabled: config.labelsFpsArmour, table: "fps_armour", hasGrade: true },
    { enabled: config.labelsFpsHelmets, table: "fps_helmets", hasGrade: true },
    { enabled: config.labelsFpsAttachments, table: "fps_attachments", hasGrade: false },
    { enabled: config.labelsFpsUtilities, table: "fps_utilities", hasGrade: false },
    { enabled: config.labelsConsumables, table: "consumables", hasGrade: false },
    { enabled: config.labelsShipMissiles, table: "ship_missiles", hasGrade: false },
  ];

  for (const cat of categoryQueries) {
    if (!cat.enabled) continue;

    const gradeCol = cat.hasGrade ? "t.grade" : "NULL as grade";
    // Not all tables have size — consumables and ship_missiles don't
    const hasSizeCol = !["consumables"].includes(cat.table);
    const sizeCol = hasSizeCol ? "t.size" : "NULL as size";

    const rows = await db
      .prepare(
        `SELECT t.class_name, t.name, m.code as manufacturer_code,
                ${sizeCol}, ${gradeCol}, t.sub_type
         FROM ${cat.table} t
         LEFT JOIN manufacturers m ON m.id = t.manufacturer_id
         WHERE t.game_version_id = ?
         AND t.class_name IS NOT NULL`,
      )
      .bind(versionId)
      .all<{
        class_name: string;
        name: string;
        manufacturer_code: string | null;
        size: number | null;
        grade: string | null;
        sub_type: string | null;
      }>();

    const itemRows: ItemRow[] = rows.results.map((r) => ({
      className: r.class_name,
      name: r.name,
      manufacturerCode: r.manufacturer_code,
      size: r.size,
      grade: r.grade,
      subType: r.sub_type,
    }));

    overrides.push(...generateItemLabels(itemRows, config.labelFormat));
  }

  return overrides;
}
