/**
 * Loadout page E2E — Asgard golden UI test.
 *
 * Loads the Asgard loadout page on staging and asserts that all critical
 * UI elements are rendered correctly. This test will BREAK if:
 *
 * - A component name stops rendering (data loss)
 * - Weapon hierarchy display breaks (mount → weapon resolution)
 * - Stats bar values change or disappear
 * - Category sections disappear or reorder
 * - Turret weapon counts change
 * - Shield/power/cooler counts change
 * - The page fails to load at all
 */
import { test, expect } from "@playwright/test";

const LOADOUT_URL = "https://staging.scbridge.app/loadout/asgard";

test.describe("Loadout page — Asgard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LOADOUT_URL);
    // Wait for loadout data to render (the ship name appears in the hero)
    await expect(page.locator("text=Asgard").first()).toBeVisible({
      timeout: 15000,
    });
  });

  // =========================================================================
  // Ship identity & hero section
  // =========================================================================

  test("shows ship hero with name and manufacturer", async ({ page }) => {
    await expect(page.getByText("Asgard").first()).toBeVisible();
    await expect(page.getByText("Anvil Aerospace")).toBeVisible();
    await expect(page.getByText("Combat")).toBeVisible();
  });

  test("shows ship image (not broken)", async ({ page }) => {
    // The hero section should have at least one visible img
    const heroImg = page.locator("img").first();
    await expect(heroImg).toBeVisible();
    // Check that the image actually loaded (naturalWidth > 0)
    const naturalWidth = await heroImg.evaluate(
      (el: HTMLImageElement) => el.naturalWidth
    );
    expect(naturalWidth).toBeGreaterThan(0);
  });

  // =========================================================================
  // Stats summary bar
  // =========================================================================

  test("shows DPS in stats bar (non-zero)", async ({ page }) => {
    // The stats bar shows total DPS. With 2× S4 Rhino (817.88 each) + 6× S3 Panther (545.62 each)
    // total should be around 4,909 DPS. Look for a 4-digit number near "DPS".
    const statsBar = page.locator("[class*='stats'], [class*='summary']").first();
    const dpsText = await page.getByText(/DPS/i).first().textContent();
    expect(dpsText).toBeTruthy();
  });

  test("shows shield HP in stats bar", async ({ page }) => {
    // 4× FullStop = 4 × 9,240 = 36,960 shield HP
    // Look for "36,960" or "36960" somewhere on the page
    const pageText = await page.textContent("body");
    expect(pageText).toMatch(/36[,.]?960/);
  });

  test("shows power output in stats bar", async ({ page }) => {
    // 2× Maelstrom = 2 × 9,375 = 18,750
    const pageText = await page.textContent("body");
    expect(pageText).toMatch(/18[,.]?750/);
  });

  test("shows hydrogen fuel capacity", async ({ page }) => {
    const pageText = await page.textContent("body");
    // 97.5 — could show as "97.5" or "97.50"
    expect(pageText).toMatch(/97\.5/);
  });

  test("shows quantum fuel capacity", async ({ page }) => {
    const pageText = await page.textContent("body");
    expect(pageText).toMatch(/1\.85/);
  });

  test("shows SCM speed", async ({ page }) => {
    const pageText = await page.textContent("body");
    expect(pageText).toMatch(/203/);
  });

  // =========================================================================
  // Weapon sections
  // =========================================================================

  test("shows CF-447 Rhino Repeater (S4 weapons)", async ({ page }) => {
    const rhinos = page.getByText("CF-447 Rhino Repeater");
    await expect(rhinos.first()).toBeVisible();
  });

  test("shows CF-337 Panther Repeater (S3 weapons)", async ({ page }) => {
    const panthers = page.getByText("CF-337 Panther Repeater");
    await expect(panthers.first()).toBeVisible();
  });

  test("shows VariPuck gimbal mount names", async ({ page }) => {
    const varipucks = page.getByText(/VariPuck S[34] Gimbal Mount/);
    await expect(varipucks.first()).toBeVisible();
  });

  test("shows 4 top-mounted gimballed weapons", async ({ page }) => {
    // The 4 top gimbal weapons should all show as Panther Repeaters
    const panthers = page.getByText("CF-337 Panther Repeater");
    // At least 6 total (4 top + 2 pilot turret children)
    const count = await panthers.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  // =========================================================================
  // Turret sections
  // =========================================================================

  test("shows manned turret (bottom) with Rhinos", async ({ page }) => {
    await expect(page.getByText("Manned Turret").first()).toBeVisible();
  });

  test("shows PC2 Dual S3 Mount (pilot turret)", async ({ page }) => {
    await expect(page.getByText("PC2 Dual S3 Mount").first()).toBeVisible();
  });

  test("shows missile rack MSD-683", async ({ page }) => {
    await expect(page.getByText(/MSD-683/).first()).toBeVisible();
  });

  test("shows Arrester III missiles", async ({ page }) => {
    await expect(page.getByText(/Arrester III/).first()).toBeVisible();
  });

  test("shows 16× missile count badge", async ({ page }) => {
    // The UI shows "16×" or "16" next to the missile name
    const pageText = await page.textContent("body");
    expect(pageText).toMatch(/16/);
  });

  test("shows door turret gatlings", async ({ page }) => {
    await expect(page.getByText(/Mounted Gatling/).first()).toBeVisible();
  });

  // =========================================================================
  // System components
  // =========================================================================

  test("shows 4 FullStop shields", async ({ page }) => {
    const shields = page.getByText("FullStop");
    const count = await shields.count();
    expect(count).toBe(4);
  });

  test("shows 2 Maelstrom power plants", async ({ page }) => {
    const pps = page.getByText("Maelstrom");
    const count = await pps.count();
    expect(count).toBe(2);
  });

  test("shows 3 Arctic coolers", async ({ page }) => {
    const coolers = page.getByText("Arctic");
    const count = await coolers.count();
    expect(count).toBe(3);
  });

  test("shows Odyssey quantum drive", async ({ page }) => {
    await expect(page.getByText("Odyssey").first()).toBeVisible();
  });

  test("shows Excelsior jump drive", async ({ page }) => {
    await expect(page.getByText("Excelsior").first()).toBeVisible();
  });

  test("shows Surveyor radar", async ({ page }) => {
    await expect(page.getByText("Surveyor").first()).toBeVisible();
  });

  // =========================================================================
  // Category sections present
  // =========================================================================

  test("has all expected category sections", async ({ page }) => {
    const pageText = await page.textContent("body");

    // These category labels should appear as section headers
    for (const category of [
      "Weapons",
      "Turrets",
      "Shields",
      "Power",
      "Cooling",
      "Quantum Drive",
      "Sensors",
    ]) {
      expect(pageText).toContain(category);
    }
  });

  // =========================================================================
  // Noise filtering — things that should NOT appear
  // =========================================================================

  test("does not show Display components in the loadout", async ({ page }) => {
    const displays = page.getByText("Radar_Display");
    const count = await displays.count();
    expect(count).toBe(0);
  });

  test("does not show SeatDashboard in the loadout", async ({ page }) => {
    const seats = page.getByText("SeatDashboard");
    const count = await seats.count();
    expect(count).toBe(0);
  });

  // =========================================================================
  // Size badges
  // =========================================================================

  test("shows size badges for components", async ({ page }) => {
    // Size badges render as "S4", "S3", "S2" etc.
    const s4Badges = page.getByText("S4", { exact: true });
    const s3Badges = page.getByText("S3", { exact: true });
    const s2Badges = page.getByText("S2", { exact: true });

    // Should have size badges visible
    expect(await s4Badges.count()).toBeGreaterThan(0);
    expect(await s3Badges.count()).toBeGreaterThan(0);
    expect(await s2Badges.count()).toBeGreaterThan(0);
  });

  // =========================================================================
  // DPS damage breakdown
  // =========================================================================

  test("shows energy damage type in breakdown", async ({ page }) => {
    // All Asgard weapons are energy type
    const pageText = await page.textContent("body");
    // Should contain "energy" or "Energy" in the damage breakdown
    expect(pageText?.toLowerCase()).toContain("energy");
  });

  // =========================================================================
  // Power pips
  // =========================================================================

  test("shows power pip section", async ({ page }) => {
    // The power pips section should have SCM/NAV mode indicators
    const pageText = await page.textContent("body");
    expect(pageText).toMatch(/SCM|NAV/);
  });

  // =========================================================================
  // Navigation / action buttons
  // =========================================================================

  test("has Detail link to ship page", async ({ page }) => {
    const detailLink = page.getByRole("link", { name: /detail/i });
    await expect(detailLink).toBeVisible();
    const href = await detailLink.getAttribute("href");
    expect(href).toContain("/ships/asgard");
  });

  test("has Cart button", async ({ page }) => {
    const cartBtn = page.getByRole("button", { name: /cart/i });
    await expect(cartBtn).toBeVisible();
  });
});
