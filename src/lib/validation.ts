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
  unidentified: z.string().max(200).optional(),
  ship_code: z.string().min(1, "ship_code is required").max(200),
  ship_name: z.string().max(200).optional(),
  manufacturer_code: z.string().min(1, "manufacturer_code is required").max(10),
  manufacturer_name: z.string().min(1, "manufacturer_name is required").max(200),
  lookup: z.string().max(200).optional(),
  lti: z.boolean(),
  insurance: z.string().max(100).optional(),
  name: z.string().min(1, "name is required").max(200),
  warbond: z.boolean(),
  entity_type: z.string().min(1, "entity_type is required").max(50),
  pledge_id: z.string().max(50),
  pledge_name: z.string().max(200),
  pledge_date: z.string().max(50),
  pledge_cost: z.string().max(30),
});

/** Import body: array of HangarXplor entries, max 2000 */
export const HangarXplorImportSchema = z
  .array(HangarXplorEntrySchema)
  .max(2000, "Import limited to 2000 entries");

// --- Hangar Sync Schemas (RSI extension) ---
// String length caps prevent payload-stuffing DoS. .passthrough() kept because RSI
// scraped data varies between pledges — extra fields are normal but we cap known ones.
// Per-element schemas validate ONLY fields that are bound to SQL — .passthrough()
// avoids CPU-expensive deep validation on RSI's variable payload shape.

/** Max string lengths for sync payload fields */
const STR = { short: 200, medium: 500, url: 2000, json: 10000 } as const;

/** Flexible ID: RSI pledge IDs arrive as number or string depending on extension version */
const FlexId = z.union([z.string().max(50), z.number()]).nullable().optional();

/** Pledge item (nested inside pledge.items) — only fields bound to SQL */
const PledgeItemSchema = z.object({
  title: z.string().max(STR.short).nullable().optional().default(""),
  kind: z.string().max(50).nullable().optional(),
  manufacturerCode: z.string().max(20).nullable().optional(),
  manufacturer: z.string().max(STR.short).nullable().optional(),
  image: z.string().max(STR.url).nullable().optional(),
  customName: z.string().max(STR.short).nullable().optional(),
  serial: z.string().max(100).nullable().optional(),
  isNameable: z.union([z.boolean(), z.number()]).nullable().optional().default(false),
}).passthrough();

/** Pledge schema — fields accessed in hangar-sync route */
const SyncPledgeSchema = z.object({
  id: FlexId,
  name: z.string().max(STR.short).nullable().optional().default(""),
  value: z.string().max(100).nullable().optional(),
  valueCents: z.number().nullable().optional(),
  configurationValue: z.string().max(100).nullable().optional(),
  currency: z.string().max(100).nullable().optional(),
  date: z.string().max(100).nullable().optional(),
  isUpgraded: z.union([z.boolean(), z.number()]).nullable().optional().default(false),
  isReclaimable: z.union([z.boolean(), z.number()]).nullable().optional().default(false),
  isGiftable: z.union([z.boolean(), z.number()]).nullable().optional().default(false),
  isWarbond: z.union([z.boolean(), z.number()]).nullable().optional().default(false),
  hasLti: z.union([z.boolean(), z.number()]).nullable().optional().default(false),
  availability: z.string().max(100).nullable().optional(),
  items: z.array(PledgeItemSchema).max(200).nullable().optional().default([]),
}).passthrough();

/** Buyback pledge schema — fields accessed in hangar-sync route */
const SyncBuybackSchema = z.object({
  id: FlexId,
  name: z.string().max(STR.short).nullable().optional().default(""),
  value: z.string().max(100).nullable().optional(),
  value_cents: z.number().nullable().optional(),
  date_parsed: z.string().max(100).nullable().optional(),
  date: z.string().max(100).nullable().optional(),
  is_credit_reclaimable: z.union([z.boolean(), z.number()]).nullable().optional().default(false),
  items: z.array(z.object({}).passthrough()).max(200).nullable().optional().default([]),
}).passthrough();

/** Upgrade schema — fields accessed in hangar-sync route */
const SyncUpgradeSchema = z.object({
  pledge_id: FlexId,
  name: z.string().max(STR.short).nullable().optional().default(""),
  applied_at: z.string().max(100).nullable().optional(),
  new_value: z.string().max(100).nullable().optional(),
}).passthrough();

/** Named ship schema */
const NamedShipSchema = z.object({
  membership_id: z.union([z.number(), z.string()]).nullable().optional(),
  default_name: z.string().max(STR.short).nullable().optional().default(""),
  custom_name: z.string().max(STR.short).nullable().optional().default(""),
}).passthrough();

/** RSI account info — maximally lenient since RSI dashboard data varies */
const RsiAccountInfoSchema = z.object({
  nickname: z.string().max(100).nullable().optional().default(""),
  displayname: z.string().max(100).nullable().optional().default(""),
  avatar_url: z.string().max(STR.url).nullable().optional(),
  enlisted_since: z.string().max(100).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  concierge_level: z.string().max(100).nullable().optional(),
  subscriber_type: z.string().max(100).nullable().optional(),
  subscriber_frequency: z.string().max(100).nullable().optional(),
  store_credit_cents: z.number().nullable().optional(),
  uec_balance: z.number().nullable().optional(),
  rec_balance: z.number().nullable().optional(),
  referral_code: z.string().max(100).nullable().optional(),
  has_game_package: z.union([z.boolean(), z.number()]).nullable().optional(),
  orgs: z.array(z.object({}).passthrough()).max(20).nullable().optional(),
  all_badges: z.record(z.string(), z.unknown()).nullable().optional(),
  featured_badges: z.array(z.object({}).passthrough()).max(20).nullable().optional(),
}).passthrough().nullable();

/** Anomaly thresholds — payloads exceeding these are logged but still processed */
export const SYNC_ANOMALY_THRESHOLDS = {
  /** Max pledges before flagging as anomalous */
  pledgeCount: 500,
  /** Max total fleet value in cents before flagging */
  fleetValueCents: 50_000_00,
} as const;

/** Full hangar sync payload from extension */
export const HangarSyncPayloadSchema = z.object({
  // Lightweight per-element schemas validate only fields bound to SQL.
  // .passthrough() avoids CPU-expensive deep validation on RSI's variable payload shape.
  pledges: z.array(SyncPledgeSchema).max(2000).default([]),
  buyback_pledges: z.array(SyncBuybackSchema).max(1000).default([]),
  upgrades: z.array(SyncUpgradeSchema).max(5000).default([]),
  account: RsiAccountInfoSchema.optional().default(null),
  named_ships: z.array(NamedShipSchema).max(500).default([]),
  sync_meta: z.object({
    extension_version: z.string().max(20).default("unknown"),
    synced_at: z.string().max(50).default(""),
    pledge_count: z.number().int().min(0).max(10000).default(0),
    buyback_count: z.number().int().min(0).max(10000).default(0),
    ship_count: z.number().int().min(0).max(10000).default(0),
    item_count: z.number().int().min(0).max(50000).default(0),
  }).passthrough(),
}).passthrough();
