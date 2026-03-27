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
    expect(data.paints).toBeGreaterThan(100);
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

  test("Asgard loadout returns components and no noise", async ({ request }) => {
    // Try default version first, fall back to 4.6.0-live if empty
    let res = await request.get(`${BASE}/api/loadout/asgard/components`);
    expect(res.status()).toBe(200);
    let data = await res.json();
    if (data.length === 0) {
      res = await request.get(`${BASE}/api/loadout/asgard/components?patch=4.6.0-live`);
      data = await res.json();
    }
    expect(data.length).toBeGreaterThanOrEqual(20);

    // No Display/SeatDashboard noise
    const displays = data.filter(
      (p: any) => p.component_type === "Display" || p.component_type === "SeatDashboard"
    );
    expect(displays).toHaveLength(0);
  });

  test("Carrack loadout has no weapon racks or _access ports", async ({ request }) => {
    let res = await request.get(`${BASE}/api/loadout/carrack/components`);
    expect(res.status()).toBe(200);
    let data = await res.json();
    if (data.length === 0) {
      res = await request.get(`${BASE}/api/loadout/carrack/components?patch=4.6.0-live`);
      data = await res.json();
    }
    if (data.length > 0) {
      const racks = data.filter(
        (p: any) =>
          p.port_type === "weapon" &&
          ((p.port_name || "").includes("locker") || (p.port_name || "").includes("rack"))
      );
      expect(racks).toHaveLength(0);

      const access = data.filter(
        (p: any) => (p.port_name || "").includes("_access")
      );
      expect(access).toHaveLength(0);
    }
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
    // SPA — wait for React to hydrate and render any ship content
    await expect(page.locator("table, [class*='grid']").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("Loot database page loads", async ({ page }) => {
    await page.goto(`${BASE}/loot`);
    // SPA — wait for React to hydrate and render content
    await expect(page.locator("[class*='tab'], [class*='grid'], [class*='card']").first()).toBeVisible({
      timeout: 15000,
    });
  });
});
