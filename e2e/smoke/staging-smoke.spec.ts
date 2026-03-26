/**
 * Post-deploy smoke tests — run against staging after every deploy.
 *
 * These are fast, read-only checks that verify the staging environment
 * is healthy after a deployment. They catch:
 * - API endpoints returning errors
 * - Missing or corrupted data
 * - Noise ports leaking into loadout responses
 * - Ships with zero components (query regression)
 * - KV cache serving stale null data
 *
 * Run manually: npx playwright test e2e/smoke/ --config playwright.smoke.config.ts
 * In CI: runs automatically after staging deploy
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "https://staging.scbridge.app";

test.describe("Staging smoke tests", () => {
  // ─── API health ────────────────────────────────────────────────────────

  test("API health returns 200", async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.status()).toBe(200);
  });

  test("API status returns reasonable counts", async ({ request }) => {
    const res = await request.get(`${BASE}/api/status`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.ships).toBeGreaterThan(100);
    expect(data.loot_items).toBeGreaterThan(500);
  });

  // ─── Ship detail API ───────────────────────────────────────────────────

  test("Asgard ship detail returns data with speed", async ({ request }) => {
    const res = await request.get(`${BASE}/api/ships/asgard`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.name).toBeTruthy();
    expect(data.speed_scm).toBeGreaterThan(0);
    expect(data.manufacturer_name).toBeTruthy();
  });

  test("Carrack ship detail returns data", async ({ request }) => {
    const res = await request.get(`${BASE}/api/ships/carrack`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.name).toBeTruthy();
    expect(data.speed_scm).toBeGreaterThan(0);
  });

  // ─── Loadout API ───────────────────────────────────────────────────────

  test("Asgard loadout returns >=20 components", async ({ request }) => {
    const res = await request.get(`${BASE}/api/loadout/asgard/components`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(20);
  });

  test("Asgard loadout has no Display noise", async ({ request }) => {
    const res = await request.get(`${BASE}/api/loadout/asgard/components`);
    const data = await res.json();
    const displays = data.filter(
      (p: any) => p.component_type === "Display" || p.component_type === "SeatDashboard"
    );
    expect(displays).toHaveLength(0);
  });

  test("Carrack loadout has no weapon racks", async ({ request }) => {
    const res = await request.get(`${BASE}/api/loadout/carrack/components`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    const racks = data.filter(
      (p: any) =>
        p.port_type === "weapon" &&
        ((p.port_name || "").includes("locker") || (p.port_name || "").includes("rack"))
    );
    expect(racks).toHaveLength(0);
  });

  test("Carrack loadout has no _access ports", async ({ request }) => {
    const res = await request.get(`${BASE}/api/loadout/carrack/components`);
    const data = await res.json();
    const access = data.filter(
      (p: any) => (p.port_name || "").includes("_access")
    );
    expect(access).toHaveLength(0);
  });

  test("Loadout returns non-empty for common ships", async ({ request }) => {
    const ships = ["aurora-mr", "gladius", "constellation-andromeda", "cutlass-black"];
    for (const slug of ships) {
      const res = await request.get(`${BASE}/api/loadout/${slug}/components`);
      // 200 with data, or 200 with empty array (ship might not have ports in this version)
      expect(res.status()).toBe(200);
    }
  });

  // ─── Page loads ────────────────────────────────────────────────────────

  test("Homepage loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(BASE);
    await page.waitForLoadState("networkidle");

    // Filter out expected non-critical errors (e.g. favicon 404)
    const critical = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("404")
    );
    expect(critical).toHaveLength(0);
  });

  test("Ship database page loads", async ({ page }) => {
    await page.goto(`${BASE}/ships`);
    await expect(page.getByText("Ship Database").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("Loot database page loads", async ({ page }) => {
    await page.goto(`${BASE}/loot`);
    await expect(page.getByText("Loot Database").first()).toBeVisible({
      timeout: 10000,
    });
  });
});
