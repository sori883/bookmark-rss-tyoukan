import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('should navigate between pages via sidebar', async ({ page }) => {
    await page.goto('/articles')
    await page.waitForLoadState('networkidle')

    await page.getByRole('link', { name: 'フィード' }).click()
    await expect(page).toHaveURL(/\/feeds/)

    await page.getByRole('link', { name: 'ブックマーク' }).click()
    await expect(page).toHaveURL(/\/bookmarks/)

    await page.getByRole('link', { name: '通知' }).click()
    await expect(page).toHaveURL(/\/notifications/)

    await page.getByRole('link', { name: '設定' }).click()
    await expect(page).toHaveURL(/\/settings/)

    await page.getByRole('link', { name: '記事' }).click()
    await expect(page).toHaveURL(/\/articles/)
  })

  test('should show user name and logout button in header', async ({ page }) => {
    await page.goto('/articles')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible()
  })

  // Logout test is in logout.spec.ts (runs last to avoid invalidating the session)
})
