import { Hono } from "hono";
import { z } from "zod";
import { getAuthUser, type HonoEnv } from "../lib/types";
import { validate } from "../lib/validation";

/**
 * /api/characters — Character backup management (CHF files + headshots)
 */
export function characterRoutes() {
  const routes = new Hono<HonoEnv>();

  // GET / — List user's saved characters
  routes.get("/", async (c) => {
    const user = getAuthUser(c);
    const rows = await c.env.DB
      .prepare(
        `SELECT id, name, chf_key, headshot_key, file_size, created_at, updated_at
         FROM user_characters WHERE user_id = ? ORDER BY created_at DESC`
      )
      .bind(user.id)
      .all();
    return c.json({ characters: rows.results });
  });

  // POST / — Upload a new character (multipart: name + chf file + optional headshot)
  routes.post("/", async (c) => {
    const user = getAuthUser(c);

    const formData = await c.req.formData().catch(() => null);
    if (!formData) {
      return c.json({ error: "Expected multipart form data" }, 400);
    }

    const name = formData.get("name");
    if (!name || typeof name !== "string" || !name.trim()) {
      return c.json({ error: "Field 'name' is required" }, 400);
    }

    const chfFile = formData.get("chf");
    if (!chfFile || typeof chfFile !== "object") {
      return c.json({ error: "Field 'chf' (.chf file) is required" }, 400);
    }

    const chfBlob = chfFile as Blob;
    const maxChfSize = 10 * 1024; // 10 KB
    if (chfBlob.size > maxChfSize) {
      return c.json({ error: "CHF file must be ≤ 10 KB" }, 413);
    }

    // Insert DB row first to get the ID
    const result = await c.env.DB
      .prepare(
        `INSERT INTO user_characters (user_id, name, chf_key, file_size)
         VALUES (?, ?, '', ?)`
      )
      .bind(user.id, name.trim(), chfBlob.size)
      .run();

    const characterId = result.meta.last_row_id;
    const chfKey = `${user.id}/${characterId}.chf`;

    // Upload CHF to R2
    const chfBuffer = await chfBlob.arrayBuffer();
    await c.env.CHARACTERS.put(chfKey, chfBuffer, {
      httpMetadata: { contentType: "application/octet-stream" },
    });

    // Update the chf_key now that we have the ID
    await c.env.DB
      .prepare("UPDATE user_characters SET chf_key = ? WHERE id = ?")
      .bind(chfKey, characterId)
      .run();

    // Handle optional headshot
    let headshotKey: string | null = null;
    const headshotFile = formData.get("headshot");
    if (headshotFile && typeof headshotFile === "object") {
      const headshotBlob = headshotFile as Blob;
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(headshotBlob.type)) {
        // CHF already saved — just skip the headshot with a warning
        // Don't fail the whole upload
      } else {
        const maxImageSize = 2 * 1024 * 1024; // 2 MB
        if (headshotBlob.size <= maxImageSize) {
          headshotKey = `${user.id}/${characterId}.webp`;
          const imageBuffer = await headshotBlob.arrayBuffer();
          await c.env.CHARACTERS.put(headshotKey, imageBuffer, {
            httpMetadata: { contentType: headshotBlob.type },
          });
          await c.env.DB
            .prepare("UPDATE user_characters SET headshot_key = ? WHERE id = ?")
            .bind(headshotKey, characterId)
            .run();
        }
      }
    }

    return c.json({
      ok: true,
      character: {
        id: characterId,
        name: name.trim(),
        chf_key: chfKey,
        headshot_key: headshotKey,
        file_size: chfBlob.size,
      },
    });
  });

  // PUT /:id — Update character name
  routes.put(
    "/:id",
    validate("json", z.object({ name: z.string().min(1).max(100) })),
    async (c) => {
      const user = getAuthUser(c);
      const id = parseInt(c.req.param("id"), 10);
      const { name } = c.req.valid("json" as never) as { name: string };

      const existing = await c.env.DB
        .prepare("SELECT id FROM user_characters WHERE id = ? AND user_id = ?")
        .bind(id, user.id)
        .first();
      if (!existing) return c.json({ error: "Not found" }, 404);

      await c.env.DB
        .prepare("UPDATE user_characters SET name = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(name.trim(), id)
        .run();

      return c.json({ ok: true });
    }
  );

  // DELETE /:id — Delete character + R2 objects
  routes.delete("/:id", async (c) => {
    const user = getAuthUser(c);
    const id = parseInt(c.req.param("id"), 10);

    const row = await c.env.DB
      .prepare("SELECT chf_key, headshot_key FROM user_characters WHERE id = ? AND user_id = ?")
      .bind(id, user.id)
      .first<{ chf_key: string; headshot_key: string | null }>();
    if (!row) return c.json({ error: "Not found" }, 404);

    // Delete R2 objects (best-effort)
    try { await c.env.CHARACTERS.delete(row.chf_key); } catch { /* may not exist */ }
    if (row.headshot_key) {
      try { await c.env.CHARACTERS.delete(row.headshot_key); } catch { /* may not exist */ }
    }

    await c.env.DB
      .prepare("DELETE FROM user_characters WHERE id = ?")
      .bind(id)
      .run();

    return c.json({ ok: true });
  });

  // GET /:id/chf — Download .chf file from R2
  routes.get("/:id/chf", async (c) => {
    const user = getAuthUser(c);
    const id = parseInt(c.req.param("id"), 10);

    const row = await c.env.DB
      .prepare("SELECT name, chf_key FROM user_characters WHERE id = ? AND user_id = ?")
      .bind(id, user.id)
      .first<{ name: string; chf_key: string }>();
    if (!row) return c.json({ error: "Not found" }, 404);

    const object = await c.env.CHARACTERS.get(row.chf_key);
    if (!object) return c.json({ error: "File not found in storage" }, 404);

    const filename = `${row.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.chf`;
    return new Response(object.body, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-cache",
      },
    });
  });

  // GET /:id/headshot — Serve headshot image from R2
  routes.get("/:id/headshot", async (c) => {
    const user = getAuthUser(c);
    const id = parseInt(c.req.param("id"), 10);

    const row = await c.env.DB
      .prepare("SELECT headshot_key FROM user_characters WHERE id = ? AND user_id = ?")
      .bind(id, user.id)
      .first<{ headshot_key: string | null }>();
    if (!row || !row.headshot_key) return c.json({ error: "Not found" }, 404);

    const object = await c.env.CHARACTERS.get(row.headshot_key);
    if (!object) return c.json({ error: "File not found in storage" }, 404);

    const contentType = object.httpMetadata?.contentType ?? "image/jpeg";
    return new Response(object.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  });

  // POST /:id/headshot — Upload or replace headshot
  routes.post("/:id/headshot", async (c) => {
    const user = getAuthUser(c);
    const id = parseInt(c.req.param("id"), 10);

    const row = await c.env.DB
      .prepare("SELECT id, headshot_key FROM user_characters WHERE id = ? AND user_id = ?")
      .bind(id, user.id)
      .first<{ id: number; headshot_key: string | null }>();
    if (!row) return c.json({ error: "Not found" }, 404);

    const formData = await c.req.formData().catch(() => null);
    if (!formData) return c.json({ error: "Expected multipart form data" }, 400);

    const file = formData.get("headshot");
    if (!file || typeof file !== "object") {
      return c.json({ error: "Field 'headshot' is required" }, 400);
    }

    const blob = file as Blob;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(blob.type)) {
      return c.json({ error: "Only JPEG, PNG, or WebP images are allowed" }, 415);
    }

    const maxSize = 2 * 1024 * 1024;
    if (blob.size > maxSize) {
      return c.json({ error: "Image must be ≤ 2 MB" }, 413);
    }

    // Delete old headshot if it exists
    if (row.headshot_key) {
      try { await c.env.CHARACTERS.delete(row.headshot_key); } catch { /* ok */ }
    }

    const headshotKey = `${user.id}/${id}.webp`;
    const buffer = await blob.arrayBuffer();
    await c.env.CHARACTERS.put(headshotKey, buffer, {
      httpMetadata: { contentType: blob.type },
    });

    await c.env.DB
      .prepare("UPDATE user_characters SET headshot_key = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(headshotKey, id)
      .run();

    return c.json({ ok: true, headshot_key: headshotKey });
  });

  return routes;
}
