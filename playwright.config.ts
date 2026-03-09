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
    // Auth setup — authenticates all personas
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // Default (empty persona) — existing tests use this
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        storageState: join(__dirname, 'e2e', 'auth-states', 'empty.json'),
      },
      dependencies: ['setup'],
    },

    // Per-persona projects for targeted testing
    {
      name: 'casual',
      use: {
        browserName: 'chromium',
        storageState: join(__dirname, 'e2e', 'auth-states', 'casual.json'),
      },
      dependencies: ['setup'],
      testMatch: /.*persona.*|.*fleet.*|.*dashboard.*/,
    },
    {
      name: 'enthusiast',
      use: {
        browserName: 'chromium',
        storageState: join(__dirname, 'e2e', 'auth-states', 'enthusiast.json'),
      },
      dependencies: ['setup'],
      testMatch: /.*persona.*|.*fleet.*|.*dashboard.*|.*insurance.*|.*analysis.*/,
    },
    {
      name: 'whale',
      use: {
        browserName: 'chromium',
        storageState: join(__dirname, 'e2e', 'auth-states', 'whale.json'),
      },
      dependencies: ['setup'],
      testMatch: /.*persona.*|.*fleet.*|.*dashboard.*/,
    },
    {
      name: 'hoarder',
      use: {
        browserName: 'chromium',
        storageState: join(__dirname, 'e2e', 'auth-states', 'hoarder.json'),
      },
      dependencies: ['setup'],
      testMatch: /.*persona.*|.*fleet.*|.*dashboard.*/,
    },
    {
      name: 'edge-case',
      use: {
        browserName: 'chromium',
        storageState: join(__dirname, 'e2e', 'auth-states', 'edge-case.json'),
      },
      dependencies: ['setup'],
      testMatch: /.*persona.*|.*import.*|.*edge.*/,
    },
    {
      name: 'admin',
      use: {
        browserName: 'chromium',
        storageState: join(__dirname, 'e2e', 'auth-states', 'admin.json'),
      },
      dependencies: ['setup'],
      testMatch: /.*persona.*|.*admin.*/,
    },
    {
      name: 'org-leader',
      use: {
        browserName: 'chromium',
        storageState: join(__dirname, 'e2e', 'auth-states', 'org-leader.json'),
      },
      dependencies: ['setup'],
      testMatch: /.*persona.*|.*org.*/,
    },
  ],
})
