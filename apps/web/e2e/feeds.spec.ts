import { test, expect } from '@playwright/test'

const TEST_FEED_URL = 'https://zenn.dev/feed'

test.describe('Feeds Management', () => {
  test('should display feeds page', async ({ page }) => {
    await page.goto('/feeds')
    await page.waitForLoadState('networkidle')

    await expect(page.getByPlaceholder('https://example.com/feed.xml')).toBeVisible()
    await expect(page.getByRole('button', { name: '追加' })).toBeVisible()
  })

  test('should add and delete a feed', async ({ page }) => {
    await page.goto('/feeds')
    await page.waitForLoadState('networkidle')

    // Add a feed
    await page.getByPlaceholder('https://example.com/feed.xml').fill(TEST_FEED_URL)
    await page.getByRole('button', { name: '追加' }).click()

    // Wait for the feed to appear in the list
    await expect(page.getByRole('heading', { name: TEST_FEED_URL }).or(
      page.getByRole('heading', { name: /zenn/i })
    )).toBeVisible({ timeout: 30000 })

    // Delete the feed
    const deleteButton = page.getByRole('button', { name: /削除/ }).first()
    await deleteButton.click()

    // Confirm deletion in modal
    await expect(page.getByText('フィードの削除')).toBeVisible()
    await page.getByRole('button', { name: '削除する' }).click()

    await page.waitForTimeout(1000)
  })

  test('should show validation error for invalid URL', async ({ page }) => {
    await page.goto('/feeds')
    await page.waitForLoadState('networkidle')

    await page.getByPlaceholder('https://example.com/feed.xml').fill('abc')
    await page.getByRole('button', { name: '追加' }).click()

    // Check for either custom validation error or native HTML5 validation
    const hasError = await page.getByText('有効なURLを入力してください').isVisible({ timeout: 3000 }).catch(() => false)
    const isInvalid = await page.locator('input:invalid').isVisible().catch(() => false)
    expect(hasError || isInvalid).toBeTruthy()
  })

  test('should show OPML import section', async ({ page }) => {
    await page.goto('/feeds')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('OPMLインポート')).toBeVisible()
    await expect(page.getByRole('button', { name: 'インポート' })).toBeVisible()
  })
})
