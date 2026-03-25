import { test, expect } from '@playwright/test'

test.describe('Logout', () => {
  test('should logout and redirect to login', async ({ page }) => {
    await page.goto('/articles')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'ログアウト' }).click()

    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
    await expect(page.getByText('Googleでログイン')).toBeVisible({ timeout: 10000 })
  })
})
