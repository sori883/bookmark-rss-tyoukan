import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** Wait for the app to finish loading (spinner disappears) */
export async function waitForAppReady(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 })
}

/** Navigate to an authenticated page and wait for it to load */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path)
  await waitForAppReady(page)
}

/** Assert that the page is on the expected path */
export async function expectPath(page: Page, path: string | RegExp) {
  if (typeof path === 'string') {
    await expect(page).toHaveURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  } else {
    await expect(page).toHaveURL(path)
  }
}
