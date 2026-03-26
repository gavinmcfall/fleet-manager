import { defineConfig } from "@playwright/test";

/**
 * Smoke test config — lightweight, no auth, targets staging.
 * Used by CI after staging deploys and for manual verification.
 *
 * Usage:
 *   npx playwright test --config playwright.smoke.config.ts
 *   BASE_URL=https://staging.scbridge.app npx playwright test --config playwright.smoke.config.ts
 */
export default defineConfig({
  testDir: "./e2e/smoke",
  outputDir: "./e2e/test-results/smoke",
  timeout: 15000,
  retries: 1,
  use: {
    baseURL: process.env.BASE_URL || "https://staging.scbridge.app",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "smoke",
      use: { browserName: "chromium" },
    },
  ],
});
