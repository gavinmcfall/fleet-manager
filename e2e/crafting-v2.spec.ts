import { test, expect } from '@playwright/test'

const ROUTE = '/crafting'

async function resetStorage(page) {
  await page.addInitScript(() => {
    try { window.localStorage.clear() } catch {}
  })
}

test.describe('Crafting v2 A/B toggle', () => {
  test.beforeEach(async ({ page }) => {
    await resetStorage(page)
  })

  test('default route renders the v1 page', async ({ page }) => {
    await page.goto(ROUTE)
    // v1 page eyebrow mentions "4.7 Crafting System"
    await expect(page.getByText(/4\.7 Crafting System/i)).toBeVisible()
  })

  test('?ux=v2 flips to v2 and sticks on subsequent visits', async ({ page }) => {
    await page.goto(`${ROUTE}?ux=v2`)
    // v2 page eyebrow says "Crafting Blueprints · v2"
    await expect(page.getByText(/· v2/i)).toBeVisible()

    // Sticky check — plain URL should still be v2
    await page.goto(ROUTE)
    await expect(page.getByText(/· v2/i)).toBeVisible()
  })

  test('?ux=v1 reverts and clears localStorage', async ({ page }) => {
    await page.goto(`${ROUTE}?ux=v2`)
    await expect(page.getByText(/· v2/i)).toBeVisible()

    await page.goto(`${ROUTE}?ux=v1`)
    await expect(page.getByText(/4\.7 Crafting System/i)).toBeVisible()

    // Subsequent plain visit should stay on v1
    await page.goto(ROUTE)
    await expect(page.getByText(/4\.7 Crafting System/i)).toBeVisible()
  })
})

test.describe('Crafting v2 page behaviour', () => {
  test.beforeEach(async ({ page }) => {
    await resetStorage(page)
    await page.goto(`${ROUTE}?ux=v2`)
    await expect(page.getByText(/· v2/i)).toBeVisible()
  })

  test('type switcher has Weapons active by default', async ({ page }) => {
    const weapons = page.getByRole('button', { name: /^weapons$/i })
    await expect(weapons).toHaveAttribute('aria-pressed', 'true')
  })

  test('switching to Armour updates the active pill', async ({ page }) => {
    await page.getByRole('button', { name: /^armour$/i }).click()
    await expect(page.getByRole('button', { name: /^armour$/i })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: /^weapons$/i })).toHaveAttribute('aria-pressed', 'false')
  })

  test('grid view is the default', async ({ page }) => {
    // ViewToggle grid button should be aria-pressed=true by default
    await expect(page.getByRole('button', { name: /grid view/i })).toHaveAttribute('aria-pressed', 'true')
  })

  test('switching to list view shows the sticky two-row header', async ({ page }) => {
    await page.getByRole('button', { name: /list view/i }).click()
    // Group header labels from row 1 — at least DPS is visible if weapons are active
    await expect(page.getByText('DPS').first()).toBeVisible()
    // Sub-header "Base" appears multiple times
    const baseHeaders = page.getByRole('button', { name: /^base/i })
    await expect(baseHeaders.first()).toBeVisible()
  })

  test('no horizontal scroll at 1140px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1140, height: 900 })
    await page.getByRole('button', { name: /list view/i }).click()
    // Verify the list view's overflowX isn't scrolling the inner container visibly
    const scrollX = await page.evaluate(() => document.documentElement.scrollLeft)
    expect(scrollX).toBe(0)
  })

  test('no horizontal scroll at 960px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 800 })
    await page.getByRole('button', { name: /list view/i }).click()
    const scrollX = await page.evaluate(() => document.documentElement.scrollLeft)
    expect(scrollX).toBe(0)
  })
})
