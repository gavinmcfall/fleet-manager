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

/** RSI pledge item schema */
const RsiPledgeItemSchema = z.object({
  title: z.string(),
  kind: z.string().nullable(),
  manufacturer: z.string().optional(),
  manufacturerCode: z.string().optional(),
  image: z.string().optional(),
  customName: z.string().optional(),
  serial: z.string().optional(),
  isNameable: z.boolean().optional(),
});

/** RSI upgrade data embedded in upgrade pledges */
const RsiUpgradeDataSchema = z.object({
  id: z.number(),
  name: z.string(),
  upgrade_type: z.string(),
  upgrade_value: z.string().nullable(),
  match_items: z.array(z.object({ id: z.number(), name: z.string() })),
  target_items: z.array(z.object({ id: z.number(), name: z.string() })),
}).nullable();

/** Named ship schema */
const NamedShipSchema = z.object({
  membership_id: z.number(),
  default_name: z.string(),
  custom_name: z.string(),
});

/** RSI pledge schema */
const RsiPledgeSchema = z.object({
  id: z.number(),
  name: z.string(),
  value: z.string(),
  valueCents: z.number(),
  configurationValue: z.string(),
  currency: z.string(),
  date: z.string(),
  isUpgraded: z.boolean(),
  isReclaimable: z.boolean(),
  isGiftable: z.boolean(),
  hasUpgradeLog: z.boolean(),
  availability: z.string(),
  items: z.array(RsiPledgeItemSchema),
  nameableShips: z.array(NamedShipSchema).nullable(),
  nameReservations: z.record(z.string(), z.string()).nullable(),
  upgradeData: RsiUpgradeDataSchema,
  pledgeImage: z.string().nullable(),
  hasLti: z.boolean(),
  isWarbond: z.boolean(),
  isReward: z.boolean(),
});

/** RSI buy-back pledge */
const RsiBuyBackPledgeSchema = z.object({
  id: z.number(),
  name: z.string(),
  value: z.string(),
  value_cents: z.number().optional(),
  date: z.string(),
  date_parsed: z.string().optional(),
  items: z.array(RsiPledgeItemSchema),
  is_credit_reclaimable: z.boolean(),
  token_cost: z.number().optional(),
});

/** RSI upgrade entry */
const RsiUpgradeSchema = z.object({
  pledge_id: z.number(),
  name: z.string(),
  applied_at: z.string(),
  new_value: z.string(),
});

/** RSI account info */
const RsiAccountInfoSchema = z.object({
  nickname: z.string(),
  displayname: z.string(),
  avatar_url: z.string().optional(),
  enlisted_since: z.string().optional(),
  country: z.string().optional(),
  concierge_level: z.string().optional(),
  concierge_next_level: z.string().optional(),
  concierge_progress: z.number().optional(),
  subscriber_type: z.string().optional(),
  subscriber_frequency: z.string().optional(),
  store_credit_cents: z.number().optional(),
  uec_balance: z.number().optional(),
  rec_balance: z.number().optional(),
  org: z.object({
    name: z.string(),
    sid: z.string(),
    image: z.string().optional(),
    url: z.string().optional(),
    rank: z.string().optional(),
    is_primary: z.boolean().optional(),
    members: z.string().optional(),
  }).optional(),
  orgs: z.array(z.object({
    name: z.string(),
    sid: z.string(),
    image: z.string().optional(),
    url: z.string().optional(),
    rank: z.string().optional(),
    is_primary: z.boolean().optional(),
    members: z.string().optional(),
  })).optional(),
  featured_badges: z.array(z.object({
    title: z.string(),
    image_url: z.string(),
    org_url: z.string().optional(),
  })).optional(),
  all_badges: z.record(z.string(), z.string()).optional(),
  referral_code: z.string().optional(),
  has_game_package: z.boolean().optional(),
  is_subscriber: z.boolean().optional(),
  email: z.string().optional(),
}).nullable();

/** Full hangar sync payload from extension */
export const HangarSyncPayloadSchema = z.object({
  pledges: z.array(RsiPledgeSchema).max(2000),
  buyback_pledges: z.array(RsiBuyBackPledgeSchema).max(1000),
  upgrades: z.array(RsiUpgradeSchema).max(5000),
  account: RsiAccountInfoSchema,
  named_ships: z.array(NamedShipSchema).max(500),
  sync_meta: z.object({
    extension_version: z.string(),
    synced_at: z.string(),
    pledge_count: z.number(),
    buyback_count: z.number(),
    ship_count: z.number(),
    item_count: z.number(),
  }),
});
