import { test, expect } from '@playwright/test'

const ROUTE = '/crafting'

test.describe('Crafting page', () => {
  test('loads the crafting page directly', async ({ page }) => {
    await page.goto(ROUTE)
    // v2 page has "Blueprints" heading
    await expect(page.getByRole('heading', { name: /blueprints/i })).toBeVisible()
  })

  test('type switcher has Weapons active by default', async ({ page }) => {
    await page.goto(ROUTE)
    const weapons = page.getByRole('button', { name: /^weapons$/i })
    await expect(weapons).toHaveAttribute('aria-pressed', 'true')
  })

  test('switching to Armour updates the active pill', async ({ page }) => {
    await page.goto(ROUTE)
    await page.getByRole('button', { name: /^armour$/i }).click()
    await expect(page.getByRole('button', { name: /^armour$/i })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: /^weapons$/i })).toHaveAttribute('aria-pressed', 'false')
  })

  test('grid view is the default', async ({ page }) => {
    await page.goto(ROUTE)
    await expect(page.getByRole('button', { name: /grid view/i })).toHaveAttribute('aria-pressed', 'true')
  })

  test('switching to list view shows the sticky two-row header', async ({ page }) => {
    await page.goto(ROUTE)
    await page.getByRole('button', { name: /list view/i }).click()
    await expect(page.getByText('DPS').first()).toBeVisible()
    const baseHeaders = page.getByRole('button', { name: /^base/i })
    await expect(baseHeaders.first()).toBeVisible()
  })

  test('no horizontal scroll at 1140px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1140, height: 900 })
    await page.goto(ROUTE)
    await page.getByRole('button', { name: /list view/i }).click()
    const scrollX = await page.evaluate(() => document.documentElement.scrollLeft)
    expect(scrollX).toBe(0)
  })
})
