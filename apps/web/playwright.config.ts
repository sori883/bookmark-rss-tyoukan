import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    storageState: './e2e/.auth/storage-state.json',
    trace: 'on-first-retry',
    actionTimeout: 10000,
  },
  projects: [
    {
      name: 'no-auth',
      testMatch: 'auth.spec.ts',
      use: { storageState: { cookies: [], origins: [] } },
    },
    {
      name: 'authenticated',
      testIgnore: ['auth.spec.ts', 'logout.spec.ts'],
    },
    {
      name: 'destructive',
      testMatch: 'logout.spec.ts',
      dependencies: ['authenticated'],
    },
  ],
})
