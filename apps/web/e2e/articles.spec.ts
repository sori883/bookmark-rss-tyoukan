import { test, expect } from '@playwright/test'
import { mockAuth, bffUrl } from './helpers'

test.describe('Articles', () => {
  test.beforeEach(async ({ context }) => {
    await mockAuth(context)
  })

  test('should display articles list', async ({ page }) => {
    await page.route(`${bffUrl('/feeds')}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'f1', user_id: 'u1', url: 'https://example.com/feed', title: 'Example Feed', site_url: 'https://example.com', last_fetched_at: null, created_at: '2024-01-01' },
        ]),
      }),
    )
    await page.route(`${bffUrl('/articles')}*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'a1', user_id: 'u1', feed_id: 'f1', url: 'https://example.com/post1', title: 'Article 1', is_read: false, published_at: '2024-01-01', created_at: '2024-01-01', updated_at: '2024-01-01' },
            { id: 'a2', user_id: 'u1', feed_id: 'f1', url: 'https://example.com/post2', title: 'Article 2', is_read: true, published_at: '2024-01-02', created_at: '2024-01-02', updated_at: '2024-01-02' },
          ],
          total: 2,
          page: 1,
          limit: 20,
        }),
      }),
    )

    await page.goto('/articles')
    await expect(page.getByText('Article 1')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Article 2')).toBeVisible()
  })

  test('should show empty state when no articles', async ({ page }) => {
    await page.route(`${bffUrl('/feeds')}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    )
    await page.route(`${bffUrl('/articles')}*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0, page: 1, limit: 20 }),
      }),
    )

    await page.goto('/articles')
    await expect(page.getByText('記事がありません')).toBeVisible({ timeout: 15000 })
  })
})
