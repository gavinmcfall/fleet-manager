import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";

/**
 * Typed zValidator wrapper with a consistent error hook baked in.
 * Returns { error: "message" } for single issues, { error, details } for multiple.
 */
export function validate<
  Target extends keyof ValidationTargets,
  T extends z.ZodType,
>(target: Target, schema: T) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const issues = result.error.issues;
      if (issues.length === 1) {
        return c.json({ error: issues[0].message }, 400);
      }
      return c.json({
        error: "Validation failed",
        details: issues.map((i: z.ZodIssue) => ({ path: i.path.join("."), message: i.message })),
      }, 400);
    }
  });
}

// --- Shared Schemas ---

/** Route param with integer ID */
export const IntIdParam = z.object({
  id: z.coerce.number().int().positive({ message: "Invalid ID" }),
});

/** Route param with UUID */
export const UuidParam = z.object({
  uuid: z.string().uuid({ message: "Invalid UUID format" }),
});

/** Organisation visibility enum */
export const OrgVisibility = z.enum(["public", "org", "officers", "private"]);

/** LLM provider enum */
export const LLMProvider = z.enum(["anthropic", "openai", "google"]);

/** HangarXplor import entry schema */
export const HangarXplorEntrySchema = z.object({
  unidentified: z.string().optional(),
  ship_code: z.string().min(1, "ship_code is required"),
  ship_name: z.string().optional(),
  manufacturer_code: z.string().min(1, "manufacturer_code is required"),
  manufacturer_name: z.string().min(1, "manufacturer_name is required"),
  lookup: z.string().optional(),
  lti: z.boolean(),
  insurance: z.string().optional(),
  name: z.string().min(1, "name is required"),
  warbond: z.boolean(),
  entity_type: z.string().min(1, "entity_type is required"),
  pledge_id: z.string(),
  pledge_name: z.string(),
  pledge_date: z.string(),
  pledge_cost: z.string(),
});

/** Import body: array of HangarXplor entries, max 2000 */
export const HangarXplorImportSchema = z
  .array(HangarXplorEntrySchema)
  .max(2000, "Import limited to 2000 entries");

// --- Hangar Sync Schemas (RSI extension) ---
// These schemas are intentionally lenient (.passthrough()) because the RSI data
// comes from HTML scraping and varies between pledges. Extra/missing fields are normal.

/** RSI pledge item schema */
const RsiPledgeItemSchema = z.object({
  title: z.string().default(""),
  kind: z.string().nullable().optional().default(null),
  manufacturer: z.string().optional(),
  manufacturerCode: z.string().optional(),
  image: z.string().optional(),
  customName: z.string().optional(),
  serial: z.string().optional(),
  isNameable: z.boolean().optional(),
}).passthrough();

/** Named ship schema */
const NamedShipSchema = z.object({
  membership_id: z.number(),
  default_name: z.string(),
  custom_name: z.string(),
}).passthrough();

/** RSI pledge schema */
const RsiPledgeSchema = z.object({
  id: z.number(),
  name: z.string().default(""),
  value: z.string().default("$0.00"),
  valueCents: z.number().default(0),
  configurationValue: z.string().optional().default(""),
  currency: z.string().optional().default(""),
  date: z.string().default(""),
  isUpgraded: z.boolean().default(false),
  isReclaimable: z.boolean().default(false),
  isGiftable: z.boolean().default(false),
  hasUpgradeLog: z.boolean().default(false),
  availability: z.string().optional().default(""),
  items: z.array(RsiPledgeItemSchema).default([]),
  nameableShips: z.array(NamedShipSchema).nullable().optional().default(null),
  nameReservations: z.record(z.string(), z.string()).nullable().optional().default(null),
  upgradeData: z.unknown().nullable().optional().default(null),
  pledgeImage: z.string().nullable().optional().default(null),
  hasLti: z.boolean().default(false),
  isWarbond: z.boolean().default(false),
  isReward: z.boolean().default(false),
}).passthrough();

/** RSI buy-back pledge */
const RsiBuyBackPledgeSchema = z.object({
  id: z.number(),
  name: z.string().default(""),
  value: z.string().default("$0.00"),
  value_cents: z.number().optional(),
  date: z.string().default(""),
  date_parsed: z.string().optional(),
  items: z.array(RsiPledgeItemSchema).default([]),
  is_credit_reclaimable: z.boolean().default(false),
  token_cost: z.number().optional(),
}).passthrough();

/** RSI upgrade entry */
const RsiUpgradeSchema = z.object({
  pledge_id: z.number(),
  name: z.string().default(""),
  applied_at: z.string().default(""),
  new_value: z.string().default(""),
}).passthrough();

/** RSI account info — very lenient since RSI dashboard data varies */
const RsiAccountInfoSchema = z.object({
  nickname: z.string().default(""),
  displayname: z.string().default(""),
}).passthrough().nullable();

/** Full hangar sync payload from extension */
export const HangarSyncPayloadSchema = z.object({
  pledges: z.array(RsiPledgeSchema).max(2000).default([]),
  buyback_pledges: z.array(RsiBuyBackPledgeSchema).max(1000).default([]),
  upgrades: z.array(RsiUpgradeSchema).max(5000).default([]),
  account: RsiAccountInfoSchema.optional().default(null),
  named_ships: z.array(NamedShipSchema).max(500).default([]),
  sync_meta: z.object({
    extension_version: z.string().default("unknown"),
    synced_at: z.string().default(""),
    pledge_count: z.number().default(0),
    buyback_count: z.number().default(0),
    ship_count: z.number().default(0),
    item_count: z.number().default(0),
  }).passthrough(),
}).passthrough();
