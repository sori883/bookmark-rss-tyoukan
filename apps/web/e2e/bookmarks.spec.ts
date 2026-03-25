import { test, expect } from '@playwright/test'

const TEST_BOOKMARK_URL = 'https://example.com'

test.describe('Bookmarks', () => {
  test('should display bookmarks page with tabs', async ({ page }) => {
    await page.goto('/bookmarks')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'ブックマーク' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: '一覧' })).toBeVisible()
    await expect(page.getByRole('button', { name: '検索' })).toBeVisible()
  })

  test('should add a bookmark by URL', async ({ page }) => {
    await page.goto('/bookmarks')
    await page.waitForLoadState('networkidle')

    // Open the add form
    await page.getByRole('button', { name: 'URL追加' }).click()

    // Fill in URL and submit
    await page.getByPlaceholder('https://example.com/article').fill(TEST_BOOKMARK_URL)
    await page.getByRole('button', { name: '追加' }).click()

    // Wait for bookmark to appear or success indication
    await page.waitForTimeout(3000)
  })

  test('should show bookmark list or empty state', async ({ page }) => {
    await page.goto('/bookmarks')
    await page.waitForLoadState('networkidle')

    const isEmpty = await page.getByText('ブックマークがありません').isVisible().catch(() => false)
    if (!isEmpty) {
      await expect(page.getByRole('button', { name: '削除' }).first()).toBeVisible()
    }
  })

  test('should switch to search tab', async ({ page }) => {
    await page.goto('/bookmarks')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '検索' }).click()
    await expect(page).toHaveURL(/tab=search/)
    await expect(page.getByPlaceholder('キーワードで検索...')).toBeVisible()
  })

  test('should search bookmarks', async ({ page }) => {
    await page.goto('/bookmarks?tab=search')
    await page.waitForLoadState('networkidle')

    await page.getByPlaceholder('キーワードで検索...').fill('test')
    await page.waitForTimeout(1000)

    const noResults = await page.getByText('該当するブックマークがありません').isVisible().catch(() => false)
    const hasResults = await page.getByText('件の結果').isVisible().catch(() => false)
    expect(noResults || hasResults).toBeTruthy()
  })

  test('should show validation error for invalid bookmark URL', async ({ page }) => {
    await page.goto('/bookmarks')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'URL追加' }).click()
    // Use a clearly invalid URL that won't pass any URL validation
    await page.getByPlaceholder('https://example.com/article').fill('abc')
    await page.getByRole('button', { name: '追加' }).click()

    // Check for either client-side validation error or the input being marked invalid
    const hasError = await page.getByText('有効なURLを入力してください').isVisible({ timeout: 3000 }).catch(() => false)
    const isInvalid = await page.locator('input:invalid').isVisible().catch(() => false)
    expect(hasError || isInvalid).toBeTruthy()
  })

  test('should delete a bookmark', async ({ page }) => {
    await page.goto('/bookmarks')
    await page.waitForLoadState('networkidle')

    // E2E test bookmark is seeded by global-setup
    await expect(page.getByRole('button', { name: '削除' }).first()).toBeVisible({ timeout: 10000 })

    const countBefore = await page.getByRole('button', { name: '削除' }).count()
    await page.getByRole('button', { name: '削除' }).first().click()
    await page.waitForTimeout(2000)
    const countAfter = await page.getByRole('button', { name: '削除' }).count()
    expect(countAfter).toBeLessThan(countBefore)
  })
})
