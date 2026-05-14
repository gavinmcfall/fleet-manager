import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { setupTestDatabase } from "./apply-migrations";
import { createTestUser, authHeaders } from "./helpers";
import { diffGlobalIni } from "../src/lib/localization";

/**
 * diffGlobalIni — compares two global.ini contents and reports the
 * key-level deltas between them. Drives the "What's changed in
 * <version>" panel on the Localization page so users can see what
 * shifted between their last download and the current live patch.
 */
describe("diffGlobalIni", () => {
  it("returns empty diff when contents match", () => {
    const ini = "key1=value1\nkey2=value2\n";
    const result = diffGlobalIni(ini, ini);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.changed).toEqual([]);
  });

  it("detects added keys", () => {
    const oldIni = "key1=v1\n";
    const newIni = "key1=v1\nkey2=v2\nkey3=v3\n";
    const r = diffGlobalIni(oldIni, newIni);
    expect(r.added.sort()).toEqual(["key2", "key3"]);
    expect(r.removed).toEqual([]);
    expect(r.changed).toEqual([]);
  });

  it("detects removed keys", () => {
    const oldIni = "key1=v1\nkey2=v2\nkey3=v3\n";
    const newIni = "key1=v1\n";
    const r = diffGlobalIni(oldIni, newIni);
    expect(r.added).toEqual([]);
    expect(r.removed.sort()).toEqual(["key2", "key3"]);
    expect(r.changed).toEqual([]);
  });

  it("detects changed values", () => {
    const oldIni = "key1=old\nkey2=same\n";
    const newIni = "key1=new\nkey2=same\n";
    const r = diffGlobalIni(oldIni, newIni);
    expect(r.added).toEqual([]);
    expect(r.removed).toEqual([]);
    expect(r.changed).toEqual([{ key: "key1", oldValue: "old", newValue: "new" }]);
  });

  it("combines added + removed + changed", () => {
    const oldIni = ["keep=same", "modify=old", "drop=gone"].join("\n");
    const newIni = ["keep=same", "modify=new", "addme=fresh"].join("\n");
    const r = diffGlobalIni(oldIni, newIni);
    expect(r.added).toEqual(["addme"]);
    expect(r.removed).toEqual(["drop"]);
    expect(r.changed).toEqual([{ key: "modify", oldValue: "old", newValue: "new" }]);
  });

  it("skips comment lines and blank lines", () => {
    const oldIni = "# header\nkey1=v1\n\n; another comment\n";
    const newIni = "# different header\nkey1=v1\n";
    const r = diffGlobalIni(oldIni, newIni);
    expect(r.added).toEqual([]);
    expect(r.removed).toEqual([]);
    expect(r.changed).toEqual([]);
  });

  it("preserves leading whitespace in values (intentional)", () => {
    const oldIni = "key1=hello";
    const newIni = "key1= hello";
    const r = diffGlobalIni(oldIni, newIni);
    // Trailing whitespace in the value side is a real semantic
    // difference for game strings, so we keep them distinct.
    expect(r.changed).toEqual([{ key: "key1", oldValue: "hello", newValue: " hello" }]);
  });

  it("handles CRLF line endings", () => {
    const oldIni = "key1=v1\r\nkey2=v2\r\n";
    const newIni = "key1=v1\r\nkey3=v3\r\n";
    const r = diffGlobalIni(oldIni, newIni);
    expect(r.added).toEqual(["key3"]);
    expect(r.removed).toEqual(["key2"]);
    expect(r.changed).toEqual([]);
  });

  it("values containing = preserve the second + later occurrences", () => {
    // "Equation=2 + 2 = 4" — key is "Equation", value is "2 + 2 = 4"
    const oldIni = "Equation=2 + 2 = 4";
    const newIni = "Equation=2 + 2 = 5";
    const r = diffGlobalIni(oldIni, newIni);
    expect(r.changed).toEqual([{ key: "Equation", oldValue: "2 + 2 = 4", newValue: "2 + 2 = 5" }]);
  });

  it("empty file vs populated returns everything as added", () => {
    const r = diffGlobalIni("", "a=1\nb=2\n");
    expect(r.added.sort()).toEqual(["a", "b"]);
    expect(r.removed).toEqual([]);
    expect(r.changed).toEqual([]);
  });

  it("sorts keys deterministically for stable UI", () => {
    const oldIni = "z=1\na=1\nm=1\n";
    const newIni = "";
    const r = diffGlobalIni(oldIni, newIni);
    expect(r.removed).toEqual(["a", "m", "z"]);
  });
});

describe("GET /api/localization/diff", () => {
  let sessionToken: string;

  beforeAll(async () => {
    await setupTestDatabase(env.DB);
    const user = await createTestUser(env.DB);
    sessionToken = user.sessionToken;

    // Seed two LIVE versions with KV global.ini payloads
    await env.DB.prepare(
      `INSERT INTO game_versions (uuid, code, channel, is_default, released_at)
       VALUES ('uuid-old', '4.7.0-live', 'LIVE', 0, '2026-03-29')`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO game_versions (uuid, code, channel, is_default, released_at)
       VALUES ('uuid-new', '4.8.0-live', 'LIVE', 1, '2026-05-14')`,
    ).run();
    // Make the test version not the default so 4.8.0-live wins
    await env.DB.prepare(
      "UPDATE game_versions SET is_default = 0 WHERE code != '4.8.0-live'",
    ).run();

    await (env as unknown as { LOCALIZATION_KV: KVNamespace }).LOCALIZATION_KV.put(
      "localization:global-ini:4.7.0-live",
      ["keep=same", "modify=old", "drop=gone"].join("\n"),
    );
    await (env as unknown as { LOCALIZATION_KV: KVNamespace }).LOCALIZATION_KV.put(
      "localization:global-ini:4.8.0-live",
      ["keep=same", "modify=new", "addme=fresh"].join("\n"),
    );
  });

  it("auto-resolves from previous LIVE to current default", async () => {
    const res = await SELF.fetch("http://localhost/api/localization/diff", {
      headers: await authHeaders(sessionToken),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      from: string;
      to: string;
      added: string[];
      removed: string[];
      changed: Array<{ key: string; oldValue: string; newValue: string }>;
      added_count: number;
      removed_count: number;
      changed_count: number;
    };
    expect(body.from).toBe("4.7.0-live");
    expect(body.to).toBe("4.8.0-live");
    expect(body.added).toEqual(["addme"]);
    expect(body.removed).toEqual(["drop"]);
    expect(body.changed).toEqual([{ key: "modify", oldValue: "old", newValue: "new" }]);
    expect(body.added_count).toBe(1);
    expect(body.removed_count).toBe(1);
    expect(body.changed_count).toBe(1);
  });

  it("accepts explicit from/to query params", async () => {
    const res = await SELF.fetch(
      "http://localhost/api/localization/diff?from=4.8.0-live&to=4.7.0-live",
      { headers: await authHeaders(sessionToken) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      from: string;
      to: string;
      added: string[];
      removed: string[];
    };
    expect(body.from).toBe("4.8.0-live");
    expect(body.to).toBe("4.7.0-live");
    // Reverse direction — what was added now looks removed
    expect(body.added).toEqual(["drop"]);
    expect(body.removed).toEqual(["addme"]);
  });

  it("requires authentication", async () => {
    const res = await SELF.fetch("http://localhost/api/localization/diff");
    expect(res.status).toBe(401);
  });

  it("returns 404 if a side has no global.ini in KV", async () => {
    const res = await SELF.fetch(
      "http://localhost/api/localization/diff?from=nonexistent-version&to=4.8.0-live",
      { headers: await authHeaders(sessionToken) },
    );
    expect(res.status).toBe(404);
  });
});
