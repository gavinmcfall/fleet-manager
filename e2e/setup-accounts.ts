#!/usr/bin/env tsx
/**
 * Create test persona accounts directly in D1 via wrangler.
 * Bypasses the auth UI (no 2FA needed) — inserts into user, account, session tables.
 *
 * Usage (default — NERDZ production, legacy):
 *   source ~/.secrets && npx tsx e2e/setup-accounts.ts
 *
 * Usage (SC Bridge staging):
 *   source ~/.secrets && export CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN_SCBRIDGE
 *   export CLOUDFLARE_ACCOUNT_ID=92557ddeffaf43d64db74acf783ec49d
 *   D1_DB=scbridge-staging WRANGLER_ENV=staging WRANGLER_CONFIG=wrangler.toml \
 *     npx tsx e2e/setup-accounts.ts
 *
 * Env vars:
 *   D1_DB          — D1 database name (default "sc-companion", legacy NERDZ prod)
 *   WRANGLER_ENV   — wrangler --env flag value (default unset)
 *   WRANGLER_CONFIG — wrangler --config flag (default unset; required when using --env)
 *
 * Idempotent — skips accounts that already exist.
 * Does NOT import fleets — that requires the import API (separate step).
 */
import { execSync } from "child_process";
import { PERSONAS } from "../test/fixtures/personas";
import { randomUUID } from "crypto";

const D1_DB = process.env.D1_DB ?? "sc-companion";
const WRANGLER_ENV = process.env.WRANGLER_ENV ?? "";
const WRANGLER_CONFIG = process.env.WRANGLER_CONFIG ?? "";
const WRANGLER_FLAGS = [
  WRANGLER_ENV ? `--env ${WRANGLER_ENV}` : "",
  WRANGLER_CONFIG ? `--config ${WRANGLER_CONFIG}` : "",
].filter(Boolean).join(" ");

const ITERATIONS = 100_000;
const HASH_ALGO = "SHA-256";
const SALT_BYTES = 16;
const KEY_BYTES = 32;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const key = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: HASH_ALGO },
    keyMaterial,
    KEY_BYTES * 8,
  );
  return `pbkdf2:${ITERATIONS}:${toHex(salt)}:${toHex(new Uint8Array(key))}`;
}

function d1Execute(sql: string): string {
  // Escape single quotes in SQL for shell safety
  const escaped = sql.replace(/'/g, "'\\''");
  const cmd = `. ~/.secrets && npx wrangler d1 execute ${D1_DB} --remote${WRANGLER_FLAGS ? " " + WRANGLER_FLAGS : ""} --command '${escaped}' --json`;
  return execSync(cmd, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024, shell: "/bin/bash" });
}

function d1Query<T = Record<string, unknown>>(sql: string): T[] {
  const raw = d1Execute(sql);
  const parsed = JSON.parse(raw);
  return parsed[0]?.results ?? [];
}

async function main() {
  console.log("=== SC Bridge Test Account Setup (via D1) ===");
  console.log(`Target: D1=${D1_DB}${WRANGLER_ENV ? ` env=${WRANGLER_ENV}` : ""}${WRANGLER_CONFIG ? ` config=${WRANGLER_CONFIG}` : ""}\n`);

  const now = new Date().toISOString();

  for (const [key, persona] of Object.entries(PERSONAS)) {
    if (key === "empty") {
      console.log(`[${key}] Skipping — already exists`);
      continue;
    }

    console.log(`[${key}] Setting up ${persona.email}...`);

    // Check if account already exists
    const existing = d1Query<{ id: string }>(
      `SELECT id FROM "user" WHERE email = '${persona.email}'`,
    );

    if (existing.length > 0) {
      console.log(`  Account already exists (id: ${existing[0].id})`);

      // Still ensure role is correct
      if (persona.role === "super_admin") {
        d1Execute(
          `UPDATE "user" SET role = 'super_admin' WHERE email = '${persona.email}'`,
        );
        console.log(`  Role confirmed: super_admin`);
      }
      continue;
    }

    // Generate IDs
    const userId = randomUUID();
    const accountId = randomUUID();
    const sessionId = randomUUID();
    const sessionToken = `tok-${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Hash the password
    const passwordHash = await hashPassword(persona.password);

    // Insert user
    d1Execute(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role, status)
       VALUES ('${userId}', '${persona.displayName}', '${persona.email}', 1, '${now}', '${now}', '${persona.role}', 'active')`,
    );
    console.log(`  User created (id: ${userId})`);

    // Insert credential account (Better Auth stores password here)
    d1Execute(
      `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       VALUES ('${accountId}', '${userId}', 'credential', '${userId}', '${passwordHash}', '${now}', '${now}')`,
    );
    console.log(`  Credential account created`);

    // Insert a session so the user can be logged in
    d1Execute(
      `INSERT INTO "session" (id, "expiresAt", token, "createdAt", "updatedAt", "userId")
       VALUES ('${sessionId}', '${expiresAt}', '${sessionToken}', '${now}', '${now}', '${userId}')`,
    );
    console.log(`  Session created`);

    // Create org if needed
    if (persona.orgName) {
      const orgId = randomUUID();
      const orgSlug = persona.orgName.toLowerCase().replace(/\s+/g, "-");
      d1Execute(
        `INSERT INTO "organization" (id, name, slug, logo, metadata, "createdAt")
         VALUES ('${orgId}', '${persona.orgName}', '${orgSlug}', NULL, NULL, '${now}')`,
      );
      // Add user as owner
      const memberId = randomUUID();
      d1Execute(
        `INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt")
         VALUES ('${memberId}', '${orgId}', '${userId}', 'owner', '${now}')`,
      );
      console.log(`  Org created: ${persona.orgName}`);
    }

    console.log(`  Done`);
  }

  console.log("\n=== Account Setup Complete ===");
  console.log("\nNext step: Import fleets for each persona.");
  console.log("Run fleet import via the app UI or use the import API with each persona's session.");
}

main().catch((err) => {
  console.error("\nSetup failed:", err);
  process.exit(1);
});
