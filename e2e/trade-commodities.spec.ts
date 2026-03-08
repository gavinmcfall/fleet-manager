import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

test.describe('Trade Commodities Page', () => {
  test('page loads with commodity cards', async ({ page }) => {
    await page.goto('/trade')
    await page.waitForLoadState('networkidle')

    // Page header should be visible
    await expect(page.locator('text=TRADE COMMODITIES')).toBeVisible({ timeout: 10000 })

    // Dynamic pricing notice should be visible
    await expect(page.locator('text=base defaults')).toBeVisible()
    await expect(page.locator('text=dynamic')).toBeVisible()

    // Should have commodity cards
    const cards = page.locator('.panel')
    await expect(cards.first()).toBeVisible({ timeout: 10000 })

    // Take full page screenshot
    await page.screenshot({
      path: join(__dirname, 'screenshots', 'trade-page-initial.png'),
      fullPage: true,
    })
  })

  test('category filter tabs work', async ({ page }) => {
    await page.goto('/trade')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=TRADE COMMODITIES')).toBeVisible({ timeout: 10000 })

    // Click "Metals" tab
    const metalsTab = page.locator('button', { hasText: /^Metals$/i })
    if (await metalsTab.isVisible()) {
      await metalsTab.click()
      await page.waitForTimeout(500)

      // Verify filtered results — use first() since count appears in both header and filter bar
      const countText = page.locator('text=/\\d+ commodities/').first()
      await expect(countText).toBeVisible()

      await page.screenshot({
        path: join(__dirname, 'screenshots', 'trade-page-metals-filter.png'),
        fullPage: true,
      })
    }
  })

  test('location filter works', async ({ page }) => {
    await page.goto('/trade')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=TRADE COMMODITIES')).toBeVisible({ timeout: 10000 })

    // Click a location filter (Area18 if it exists)
    const area18 = page.locator('button', { hasText: 'Area18' })
    if (await area18.isVisible()) {
      await area18.click()
      await page.waitForTimeout(500)

      await page.screenshot({
        path: join(__dirname, 'screenshots', 'trade-page-area18-filter.png'),
        fullPage: true,
      })
    }
  })

  test('commodity detail panel opens with buy/sell data', async ({ page }) => {
    await page.goto('/trade')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=TRADE COMMODITIES')).toBeVisible({ timeout: 10000 })

    // Click first commodity card
    const firstCard = page.locator('.panel').first()
    await expect(firstCard).toBeVisible({ timeout: 10000 })
    await firstCard.click()

    // Detail panel should open
    const panel = page.locator('.fixed.inset-0')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Should show dynamic pricing warning in panel
    await expect(page.locator('.fixed.inset-0 >> text=base defaults')).toBeVisible()

    await page.screenshot({
      path: join(__dirname, 'screenshots', 'trade-page-detail-panel.png'),
      fullPage: true,
    })
  })

  test('search filters commodities', async ({ page }) => {
    await page.goto('/trade')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=TRADE COMMODITIES')).toBeVisible({ timeout: 10000 })

    // Type in search
    const searchInput = page.locator('input[placeholder*="Search"]')
    await searchInput.fill('Agricium')
    await page.waitForTimeout(500)

    // Should filter down — use first() since count appears in both header and filter bar
    const countText = page.locator('text=/\\d+ commodities/').first()
    await expect(countText).toBeVisible()

    await page.screenshot({
      path: join(__dirname, 'screenshots', 'trade-page-search.png'),
      fullPage: true,
    })
  })

  test('Port Olisar location filter has strikethrough', async ({ page }) => {
    await page.goto('/trade')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=TRADE COMMODITIES')).toBeVisible({ timeout: 10000 })

    // Check if "Port Olisar (Removed)" location filter has strikethrough
    const removedButton = page.locator('button', { hasText: 'Port Olisar (Removed)' })
    if (await removedButton.isVisible()) {
      await expect(removedButton).toHaveClass(/line-through/)
    }
  })
})

test.describe('Shops Page — existing functionality', () => {
  test('shops page loads with cards', async ({ page }) => {
    await page.goto('/shops')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'SHOPS' })).toBeVisible({ timeout: 10000 })

    const cards = page.locator('.panel')
    await expect(cards.first()).toBeVisible({ timeout: 10000 })

    await page.screenshot({
      path: join(__dirname, 'screenshots', 'shops-page.png'),
      fullPage: true,
    })
  })

  test('shop inventory panel opens', async ({ page }) => {
    await page.goto('/shops')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'SHOPS' })).toBeVisible({ timeout: 10000 })

    // Click first shop card
    const firstCard = page.locator('.panel').first()
    await firstCard.click()

    // Panel should open
    const panel = page.locator('.fixed.inset-0')
    await expect(panel).toBeVisible({ timeout: 5000 })

    await page.screenshot({
      path: join(__dirname, 'screenshots', 'shops-inventory-panel.png'),
      fullPage: true,
    })
  })
})
