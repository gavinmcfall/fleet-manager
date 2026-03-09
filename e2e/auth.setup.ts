import { test as setup, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { PERSONAS } from '../test/fixtures/personas'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** Auth state file paths by persona key */
export const AUTH_FILES: Record<string, string> = {}
for (const key of Object.keys(PERSONAS)) {
  AUTH_FILES[key] = join(__dirname, 'auth-states', `${key}.json`)
}

/** Legacy default auth file (empty persona) */
export const AUTH_FILE = AUTH_FILES.empty

// Authenticate the default empty persona
setup('authenticate', async ({ page }) => {
  const persona = PERSONAS.empty
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"], input[name="email"]', persona.email)
  await page.fill('input[type="password"], input[name="password"]', persona.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
  await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 })
  await page.context().storageState({ path: AUTH_FILES.empty })
})

// Authenticate each additional persona
for (const [key, persona] of Object.entries(PERSONAS)) {
  if (key === 'empty') continue

  setup(`authenticate-${key}`, async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"], input[name="email"]', persona.email)
    await page.fill('input[type="password"], input[name="password"]', persona.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 15000 })
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 })
    await page.context().storageState({ path: AUTH_FILES[key] })
  })
}
