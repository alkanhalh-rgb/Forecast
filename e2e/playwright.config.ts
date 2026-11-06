import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a running stack (docker compose up, or pnpm dev) with
 * ENABLE_TEST_ROUTES=true. They never run against production.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    ...devices['Pixel 7'],
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
    trace: 'off',
  },
});
