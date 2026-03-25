import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should redirect unauthenticated user to login page', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('should show login page with Google OAuth button', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Googleでログイン')).toBeVisible()
    await expect(page.getByText('Bookmark RSS Tyoukan')).toBeVisible()
  })
})
