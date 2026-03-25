import { test, expect } from '@playwright/test'

test.describe('Articles', () => {
  test('should display articles page with heading and filters', async ({ page }) => {
    await page.goto('/articles')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: '記事一覧' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('未読のみ')).toBeVisible()
  })

  test('should show empty state or article list', async ({ page }) => {
    await page.goto('/articles')
    await page.waitForLoadState('networkidle')

    const hasArticles = await page.getByText('記事がありません').isVisible().catch(() => false)
    if (hasArticles) {
      await expect(page.getByText('記事がありません')).toBeVisible()
    } else {
      // Articles exist
      await expect(page.locator('a[href*="http"]').first()).toBeVisible({ timeout: 15000 })
    }
  })

  test('should toggle unread filter via button', async ({ page }) => {
    await page.goto('/articles')
    await page.waitForLoadState('networkidle')

    // Click the unread filter button
    const filterButton = page.getByText('未読のみ')
    await filterButton.click()
    await expect(page).toHaveURL(/is_read=false/)

    // Click again to deactivate filter
    await filterButton.click()
    await expect(page).not.toHaveURL(/is_read=false/)
  })
})
