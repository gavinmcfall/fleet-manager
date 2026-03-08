import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',
  timeout: 30000,
  use: {
    baseURL: 'https://scbridge.app',
    screenshot: 'on',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        storageState: join(__dirname, 'e2e', '.auth-state.json'),
      },
      dependencies: ['setup'],
    },
  ],
})
