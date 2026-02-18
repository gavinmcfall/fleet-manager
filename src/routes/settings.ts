import { Hono } from "hono";
import type { Env } from "../lib/types";

/**
 * /api/settings/* — User settings and LLM configuration
 */
export function settingsRoutes<E extends { Bindings: Env }>() {
  const routes = new Hono<E>();

  // GET /api/settings/llm-config
  routes.get("/llm-config", async (c) => {
    const db = c.env.DB;
    const userID = await getDefaultUserID(db);
    if (userID === null) {
      return c.json({ error: "Default user not found" }, 500);
    }

    const config = await db
      .prepare(
        "SELECT id, provider, encrypted_api_key, model FROM user_llm_configs WHERE user_id = ? LIMIT 1",
      )
      .bind(userID)
      .first<{
        id: number;
        provider: string;
        encrypted_api_key: string;
        model: string;
      }>();

    let provider = "";
    let maskedKey = "";
    let model = "";
    let apiKeySet = false;

    if (config) {
      provider = config.provider;
      model = config.model ?? "";
      if (config.encrypted_api_key) {
        apiKeySet = true;
        // TODO: Phase 5 — decrypt and mask the key
        maskedKey = "sk-...configured";
      }
    }

    return c.json({
      provider,
      api_key_set: apiKeySet,
      api_key_mask: maskedKey,
      model,
    });
  });

  // PUT /api/settings/llm-config
  routes.put("/llm-config", async (c) => {
    const db = c.env.DB;
    const userID = await getDefaultUserID(db);
    if (userID === null) {
      return c.json({ error: "Default user not found" }, 500);
    }

    const body = await c.req.json<{
      provider?: string;
      api_key?: string;
      model?: string;
    }>();

    // Clear operation
    if (!body.provider && !body.api_key && !body.model) {
      await db.prepare("DELETE FROM user_llm_configs WHERE user_id = ?").bind(userID).run();
      return c.json({ message: "LLM configuration cleared" });
    }

    // Validate provider
    const validProviders = ["openai", "anthropic", "google"];
    if (!body.provider || !validProviders.includes(body.provider)) {
      return c.json({ error: "Invalid provider" }, 400);
    }

    if (!body.api_key?.trim()) {
      return c.json({ error: "API key is required when provider is set" }, 400);
    }

    // TODO: Phase 5 — encrypt the API key with Web Crypto API
    const encryptedKey = body.api_key; // Placeholder — will encrypt in Phase 5

    await db
      .prepare(
        `INSERT INTO user_llm_configs (user_id, provider, encrypted_api_key, model, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(user_id, provider) DO UPDATE SET
          encrypted_api_key=excluded.encrypted_api_key,
          model=excluded.model,
          updated_at=excluded.updated_at`,
      )
      .bind(userID, body.provider, encryptedKey, body.model ?? "")
      .run();

    return c.json({ message: "LLM configuration saved" });
  });

  return routes;
}

async function getDefaultUserID(db: D1Database): Promise<number | null> {
  const row = await db
    .prepare("SELECT id FROM users WHERE username = 'default'")
    .first<{ id: number }>();
  return row?.id ?? null;
}
