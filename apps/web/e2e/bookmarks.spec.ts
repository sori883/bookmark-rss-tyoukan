import { test, expect } from '@playwright/test'
import { mockAuth, bffUrl } from './helpers'

test.describe('Bookmarks', () => {
  test.beforeEach(async ({ context }) => {
    await mockAuth(context)
  })

  test('should display bookmark list', async ({ page }) => {
    await page.route(`${bffUrl('/bookmarks')}?*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'b1', user_id: 'u1', article_id: null, url: 'https://example.com/post', title: 'Bookmarked Post', content_markdown: '# Content', created_at: '2024-01-01', updated_at: '2024-01-01' },
          ],
          total: 1,
          page: 1,
          limit: 20,
        }),
      }),
    )

    await page.goto('/bookmarks')
    await expect(page.getByText('Bookmarked Post')).toBeVisible({ timeout: 15000 })
  })

  test('should view bookmark detail with markdown content', async ({ page }) => {
    await page.route(`${bffUrl('/bookmarks/b1')}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'b1', user_id: 'u1', article_id: null,
          url: 'https://example.com/post', title: 'Bookmarked Post',
          content_markdown: '# Hello\n\nThis is **bold** content.',
          created_at: '2024-01-01', updated_at: '2024-01-01',
        }),
      }),
    )

    await page.goto('/bookmarks/b1')
    await expect(page.getByText('Hello')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('bold')).toBeVisible()
  })

  test('should search bookmarks', async ({ page }) => {
    await page.route(`${bffUrl('/bookmarks')}?*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0, page: 1, limit: 20 }),
      }),
    )
    await page.route(`${bffUrl('/bookmarks/search')}*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'b2', user_id: 'u1', article_id: null, url: 'https://example.com/found', title: 'Search Result', content_markdown: 'found', created_at: '2024-01-01', updated_at: '2024-01-01' },
          ],
          total: 1,
          page: 1,
          limit: 20,
        }),
      }),
    )

    await page.goto('/bookmarks?tab=search')
    await page.waitForSelector('input[type="search"]', { timeout: 15000 })
    await page.fill('input[type="search"]', 'test query')
    await expect(page.getByText('Search Result')).toBeVisible({ timeout: 15000 })
  })
})
