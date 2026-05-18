import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { env } from "cloudflare:test";
import { setupTestDatabase, TEST_GAME_VERSION_ID } from "./apply-migrations";
import { closePaintImageGap } from "../src/sync/paintImageGap";

/**
 * Paint image gap closer — runs as a sibling to the nightly RSI image cron.
 * Migrates a small batch of paints from RSI CDN URLs to CF Images delivery
 * URLs. Verifies skip behavior, batch size, post-update querying.
 */

const CF_OK_RESPONSE = {
  ok: true,
  status: 200,
  json: async () => ({
    success: true,
    result: { id: "cf-test-image-id" },
  }),
} as unknown as Response;

async function seedPaint(name: string, slug: string, image_url: string): Promise<number> {
  const result = await env.DB
    .prepare(
      `INSERT INTO paints (game_version_id, name, slug, image_url)
       VALUES (?, ?, ?, ?) RETURNING id`,
    )
    .bind(TEST_GAME_VERSION_ID, name, slug, image_url)
    .first<{ id: number }>();
  return result!.id;
}

describe("closePaintImageGap", () => {
  beforeAll(async () => {
    await setupTestDatabase(env.DB);
  });

  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM paints").run();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips with a reason when CF Images creds are missing", async () => {
    await seedPaint("X1", "x1", "https://media.robertsspaceindustries.com/abc/image.jpg");
    const stubEnv = { ...env, CLOUDFLARE_IMAGES_TOKEN: undefined, CF_ACCOUNT_HASH: undefined, CF_ACCOUNT_ID: undefined } as unknown as Parameters<typeof closePaintImageGap>[0];
    const result = await closePaintImageGap(stubEnv);
    expect(result.skipped).toBe(true);
    expect(result.reason).toMatch(/credentials/);
    expect(result.processed).toBe(0);
  });

  it("returns 0/0 when no paints need migration", async () => {
    await seedPaint("Already migrated", "already-migrated", "https://imagedelivery.net/hash/img/medium");
    const stubEnv = { ...env, CLOUDFLARE_IMAGES_TOKEN: "tok", CF_ACCOUNT_HASH: "hash", CF_ACCOUNT_ID: "acct" } as unknown as Parameters<typeof closePaintImageGap>[0];
    const result = await closePaintImageGap(stubEnv);
    expect(result.processed).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.remaining).toBe(0);
  });

  it("honors the limit option and reports remaining", async () => {
    for (let i = 0; i < 5; i++) {
      await seedPaint(`P${i}`, `p${i}`, `https://media.robertsspaceindustries.com/img${i}.jpg`);
    }
    vi.spyOn(globalThis, "fetch").mockResolvedValue(CF_OK_RESPONSE);
    const stubEnv = { ...env, CLOUDFLARE_IMAGES_TOKEN: "tok", CF_ACCOUNT_HASH: "hash", CF_ACCOUNT_ID: "acct" } as unknown as Parameters<typeof closePaintImageGap>[0];
    const result = await closePaintImageGap(stubEnv, { limit: 2 });
    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(result.remaining).toBe(3);
  });

  it("rewrites paint.image_url to the CF Images delivery URL on success", async () => {
    const id = await seedPaint("Migrated", "migrated", "https://media.robertsspaceindustries.com/abc/image.jpg");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(CF_OK_RESPONSE);
    const stubEnv = { ...env, CLOUDFLARE_IMAGES_TOKEN: "tok", CF_ACCOUNT_HASH: "hash", CF_ACCOUNT_ID: "acct" } as unknown as Parameters<typeof closePaintImageGap>[0];
    await closePaintImageGap(stubEnv, { limit: 1 });
    const row = await env.DB.prepare("SELECT image_url FROM paints WHERE id = ?").bind(id).first<{ image_url: string }>();
    expect(row?.image_url).toBe("https://imagedelivery.net/hash/cf-test-image-id/medium");
  });

  it("records errors and keeps row untouched when CF upload fails", async () => {
    const id = await seedPaint("Failing", "failing", "https://media.robertsspaceindustries.com/abc/image.jpg");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, errors: [{ code: 9999, message: "kaboom" }] }),
    } as unknown as Response);
    const stubEnv = { ...env, CLOUDFLARE_IMAGES_TOKEN: "tok", CF_ACCOUNT_HASH: "hash", CF_ACCOUNT_ID: "acct" } as unknown as Parameters<typeof closePaintImageGap>[0];
    const result = await closePaintImageGap(stubEnv, { limit: 1 });
    expect(result.failed).toBe(1);
    expect(result.errors[0].name).toBe("Failing");
    const row = await env.DB.prepare("SELECT image_url FROM paints WHERE id = ?").bind(id).first<{ image_url: string }>();
    expect(row?.image_url).toBe("https://media.robertsspaceindustries.com/abc/image.jpg");
  });
});
