const DEFAULT_TTL = 86400; // 24 hours

/** Sanitize a user-supplied value for use in cache keys. Strips colons to prevent namespace collision. */
export function cacheSlug(value: string): string {
  return value.replace(/:/g, "_");
}

/** Minimal context shape needed by cachedJson — accepts both HonoEnv and generic route contexts */
interface CacheableContext {
  env: { SC_BRIDGE_CACHE: KVNamespace };
  executionCtx: { waitUntil(promise: Promise<unknown>): void };
  json(data: unknown, status?: number): Response;
}

/**
 * Resolve the effective game version ID for cache keying.
 * Cheap indexed lookup on a tiny table (~10 rows).
 */
export async function resolveVersionId(
  db: D1Database,
  patchCode?: string,
): Promise<number> {
  const sql = patchCode
    ? "SELECT id FROM game_versions WHERE code = ?"
    : "SELECT id FROM game_versions WHERE is_default = 1";
  const row = patchCode
    ? await db.prepare(sql).bind(patchCode).first<{ id: number }>()
    : await db.prepare(sql).first<{ id: number }>();
  return row?.id ?? -1;
}

/**
 * Read-through cache for JSON responses.
 *
 * - On cache HIT: returns KV value directly (no DB query)
 * - On cache MISS: calls dataFn(), writes result to KV, returns it
 * - Null/undefined results are NOT cached (for 404 handling)
 * - Adds X-Cache: HIT/MISS header for observability
 */
export async function cachedJson<T>(
  c: CacheableContext,
  cacheKey: string,
  dataFn: () => Promise<T>,
  options?: { ttl?: number; cacheControl?: string },
): Promise<Response> {
  const kv = c.env.SC_BRIDGE_CACHE;
  const ttl = options?.ttl ?? DEFAULT_TTL;
  const cacheControl = options?.cacheControl ?? "public, max-age=300";

  // Attempt cache read
  const cached = await kv.get(cacheKey);
  if (cached !== null) {
    return new Response(cached, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": cacheControl,
        "X-Cache": "HIT",
        "X-Cache-Key": cacheKey,
      },
    });
  }

  // Cache miss — fetch from DB
  const data = await dataFn();

  // Don't cache null/undefined (let caller handle 404)
  if (data === null || data === undefined) {
    return c.json({ error: "Not found" }, 404);
  }

  const json = JSON.stringify(data);

  // Write to KV in background (don't block response)
  c.executionCtx.waitUntil(
    kv.put(cacheKey, json, { expirationTtl: ttl }).catch((err) => {
      console.error(`[cache] KV put failed for ${cacheKey}:`, err);
    }),
  );

  return new Response(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": cacheControl,
      "X-Cache": "MISS",
      "X-Cache-Key": cacheKey,
    },
  });
}

/**
 * Purge cached keys by prefix. Uses KV list() to find matching keys.
 */
export async function purgeByPrefix(
  kv: KVNamespace,
  prefix?: string,
): Promise<{ deleted: number }> {
  let deleted = 0;
  let cursor: string | undefined;

  do {
    const list = await kv.list({
      prefix: prefix ?? undefined,
      cursor,
      limit: 1000,
    });

    if (list.keys.length > 0) {
      await Promise.all(list.keys.map((key) => kv.delete(key.name)));
      deleted += list.keys.length;
    }

    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return { deleted };
}
