import { test as setup, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const AUTH_FILE = join(__dirname, '.auth-state.json')

/**
 * Log in via Better Auth email/password and save the session cookie.
 * Subsequent tests reuse this auth state.
 */
setup('authenticate', async ({ page }) => {
  // Navigate to login
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  // Fill in credentials
  await page.fill('input[type="email"], input[name="email"]', 'e2e-test@scbridge.app')
  await page.fill('input[type="password"], input[name="password"]', 'E2ETestPass123!')

  // Submit
  await page.click('button[type="submit"]')

  // Wait for redirect to dashboard (successful login)
  await page.waitForURL('/', { timeout: 15000 })

  // Verify we're logged in
  await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 })

  // Save auth state
  await page.context().storageState({ path: AUTH_FILE })
})

export { AUTH_FILE }
