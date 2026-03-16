#!/usr/bin/env node
/**
 * Take screenshots of SC Bridge for README and Chrome Web Store listing.
 * Logs in as Citizen 001 and captures key pages.
 *
 * Usage: node scripts/screenshots.mjs
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.BASE_URL || 'https://staging.scbridge.app';
const EMAIL = 'nzvengeance@live.com';
const PASSWORD = 'tgu9ZRC8pnw*but7fxz';
const OUT_DIR = join(process.cwd(), 'screenshots');
const EXT_DIR = join(process.cwd(), 'screenshots', 'extension');

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(EXT_DIR, { recursive: true });

async function login(page) {
  console.log('Logging in as Citizen 001...');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  // Wait for redirect away from login
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  console.log('Logged in:', page.url());
}

async function snap(page, url, name, opts = {}) {
  const { waitFor, fullPage = false, delay = 1500 } = opts;
  console.log(`  ${name}...`);
  await page.goto(`${BASE_URL}${url}`);
  await page.waitForLoadState('networkidle');
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(delay);
  await page.screenshot({ path: join(OUT_DIR, `${name}.png`), fullPage });
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ── README screenshots (1440x900 @2x) ──
  console.log('\n=== README Screenshots ===');
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await login(page);

  await snap(page, '/', 'dashboard');
  await snap(page, '/fleet', 'fleet', { waitFor: 'table' });
  await snap(page, '/ships/idris-p', 'ship-detail-idris', { delay: 2000 });
  await snap(page, '/ships/carrack-expedition', 'ship-detail-carrack', { delay: 2000 });
  await snap(page, '/insurance', 'insurance');
  await snap(page, '/ships', 'shipdb', { waitFor: 'table', delay: 2000 });
  await snap(page, '/sync-import', 'sync-import');
  await snap(page, '/loot', 'loot-db', { delay: 2500 });
  await snap(page, '/analysis', 'analysis');
  await snap(page, '/npc-loadouts', 'npc-loadouts', { delay: 2000 });
  await snap(page, '/settings', 'settings');

  await ctx.close();

  // ── Chrome Web Store screenshots (1280x800 @1x, no alpha) ──
  console.log('\n=== Chrome Web Store Screenshots (1280x800) ===');
  const extCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const extPage = await extCtx.newPage();
  await login(extPage);

  const extSnap = async (url, name, opts = {}) => {
    const { waitFor, delay = 1500 } = opts;
    console.log(`  ${name}...`);
    await extPage.goto(`${BASE_URL}${url}`);
    await extPage.waitForLoadState('networkidle');
    if (waitFor) await extPage.waitForSelector(waitFor, { timeout: 10000 }).catch(() => {});
    await extPage.waitForTimeout(delay);
    await extPage.screenshot({ path: join(EXT_DIR, `${name}.png`) });
  };

  // 5 screenshots for store listing
  await extSnap('/fleet', 'store-1-fleet', { waitFor: 'table' });
  await extSnap('/insurance', 'store-2-insurance');
  await extSnap('/ships/idris-p', 'store-3-ship-detail', { delay: 2000 });
  await extSnap('/sync-import', 'store-4-sync');
  await extSnap('/loot', 'store-5-loot', { delay: 2500 });

  await extCtx.close();

  // ── Small promo tile (440x280) ──
  console.log('\n=== Promo Tiles ===');
  const promoCtx = await browser.newContext({
    viewport: { width: 440, height: 280 },
    deviceScaleFactor: 1,
  });
  const promoPage = await promoCtx.newPage();
  await login(promoPage);
  console.log('  small-promo (440x280)...');
  await promoPage.goto(`${BASE_URL}/fleet`);
  await promoPage.waitForLoadState('networkidle');
  await promoPage.waitForTimeout(2000);
  await promoPage.screenshot({ path: join(EXT_DIR, 'small-promo-440x280.png') });
  await promoCtx.close();

  // ── Marquee promo tile (1400x560) ──
  const marqueeCtx = await browser.newContext({
    viewport: { width: 1400, height: 560 },
    deviceScaleFactor: 1,
  });
  const marqueePage = await marqueeCtx.newPage();
  await login(marqueePage);
  console.log('  marquee-promo (1400x560)...');
  await marqueePage.goto(`${BASE_URL}/fleet`);
  await marqueePage.waitForLoadState('networkidle');
  await marqueePage.waitForTimeout(2000);
  await marqueePage.screenshot({ path: join(EXT_DIR, 'marquee-promo-1400x560.png') });
  await marqueeCtx.close();

  await browser.close();
  console.log(`\nDone! Files in:\n  ${OUT_DIR}/\n  ${EXT_DIR}/`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
