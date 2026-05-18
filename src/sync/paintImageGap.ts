/**
 * Paint image gap closer.
 *
 * Background: paint rows land in D1 with RSI CDN image URLs (from extraction
 * scripts) and need to be re-hosted on Cloudflare Images so the SC Bridge
 * frontend can render them through its imagedelivery.net pipeline. Until now
 * this was a manual admin action (POST /api/admin/images/paint-bulk-upload).
 * Each new patch leaves dozens-to-hundreds of paints needing the migration.
 *
 * This module runs the same migration logic from the nightly cron in small
 * batches so the gap closes on its own without an operator pressing a button
 * every patch day. Same SELECT, same UPDATE — just driven by the scheduled
 * handler instead of an HTTP request.
 *
 * No-op (returns skipped=true) when CF Images credentials aren't bound —
 * staging deploys leave the token unset to avoid spending production quota.
 */

import { concurrentMap } from "../lib/utils";
import { uploadToCFImages } from "../lib/cfImages";
import type { Env } from "../lib/types";

export interface PaintImageGapResult {
  skipped?: boolean;
  reason?: string;
  processed: number;
  succeeded: number;
  failed: number;
  remaining: number;
  errors: { name: string; error: string }[];
}

interface PaintRow {
  id: number;
  name: string;
  slug: string;
  image_url: string;
}

const DEFAULT_LIMIT = 25;
const CONCURRENCY = 5;

export async function closePaintImageGap(
  env: Env,
  options: { limit?: number } = {},
): Promise<PaintImageGapResult> {
  const token = env.CLOUDFLARE_IMAGES_TOKEN;
  const accountHash = env.CF_ACCOUNT_HASH;
  const accountId = env.CF_ACCOUNT_ID;

  if (!token || !accountHash || !accountId) {
    return {
      skipped: true,
      reason: "CF Images credentials not configured",
      processed: 0,
      succeeded: 0,
      failed: 0,
      remaining: 0,
      errors: [],
    };
  }

  const envLimit = Number(env.PAINT_IMAGE_GAP_LIMIT);
  const limit = options.limit ?? (Number.isFinite(envLimit) && envLimit > 0 ? envLimit : DEFAULT_LIMIT);
  const db = env.DB;

  const { results } = await db
    .prepare(
      `SELECT id, name, slug, image_url FROM paints
       WHERE image_url IS NOT NULL AND image_url != ''
         AND image_url NOT LIKE 'https://imagedelivery.net%'
       ORDER BY id
       LIMIT ?`,
    )
    .bind(limit)
    .all<PaintRow>();

  const paints = results ?? [];
  const errors: { name: string; error: string }[] = [];

  const outcomes = await concurrentMap(paints, CONCURRENCY, async (p) => {
    try {
      const cfImagesId = await uploadToCFImages(accountId, token, p.image_url, {
        slug: p.slug,
        paint_id: String(p.id),
        type: "paint",
      });
      const deliveryUrl = `https://imagedelivery.net/${accountHash}/${cfImagesId}/medium`;
      await db
        .prepare("UPDATE paints SET image_url = ? WHERE id = ?")
        .bind(deliveryUrl, p.id)
        .run();
      return true;
    } catch (err) {
      errors.push({ name: p.name, error: String(err) });
      console.error(`[paint-gap] CF upload failed for ${p.name}:`, err);
      return false;
    }
  });

  const succeeded = outcomes.filter(Boolean).length;
  const failed = outcomes.length - succeeded;

  const remaining = await db
    .prepare(
      `SELECT COUNT(*) as cnt FROM paints
       WHERE image_url IS NOT NULL AND image_url != ''
         AND image_url NOT LIKE 'https://imagedelivery.net%'`,
    )
    .first<{ cnt: number }>();

  return {
    processed: paints.length,
    succeeded,
    failed,
    remaining: remaining?.cnt ?? 0,
    errors,
  };
}
