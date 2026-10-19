import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'workspace.spec.ts',
  workers: 1,
  timeout: 180000,
  expect: { timeout: 60000 },
  use: {
    baseURL: 'http://127.0.0.1:3001',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
