import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should redirect unauthenticated user to login page', async ({ page }) => {
    await page.goto('/articles')
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })

  test('should show login page with Google OAuth button', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Bookmark RSS Tyoukan')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Googleでログイン')).toBeVisible()
  })

  test('should redirect authenticated user from login to articles', async ({ browser }) => {
    // Use authenticated storageState
    const context = await browser.newContext({
      storageState: './e2e/.auth/storage-state.json',
    })
    const page = await context.newPage()
    await page.goto('/login')
    await expect(page).toHaveURL(/\/articles/, { timeout: 15000 })
    await context.close()
  })

  test('should redirect root to articles when authenticated', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: './e2e/.auth/storage-state.json',
    })
    const page = await context.newPage()
    await page.goto('/')
    await expect(page).toHaveURL(/\/articles/, { timeout: 15000 })
    await context.close()
  })
})
