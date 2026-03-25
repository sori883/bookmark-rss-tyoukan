import { test, expect } from '@playwright/test'
import { mockAuth, bffUrl } from './helpers'

test.describe('Feeds Management', () => {
  test.beforeEach(async ({ context }) => {
    await mockAuth(context)
  })

  test('should display feed list', async ({ page }) => {
    await page.route(`${bffUrl('/feeds')}`, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: '1', user_id: 'u1', url: 'https://example.com/feed', title: 'Example Feed', site_url: 'https://example.com', last_fetched_at: null, created_at: '2024-01-01' },
          ]),
        })
      }
      return route.continue()
    })

    await page.goto('/feeds')
    await expect(page.getByText('Example Feed')).toBeVisible({ timeout: 15000 })
  })

  test('should show empty state when no feeds', async ({ page }) => {
    await page.route(`${bffUrl('/feeds')}`, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
      }
      return route.continue()
    })

    await page.goto('/feeds')
    await expect(page.getByText('フィードが登録されていません')).toBeVisible({ timeout: 15000 })
  })

  test('should add a new feed', async ({ page }) => {
    let feeds: unknown[] = []
    await page.route(`${bffUrl('/feeds')}`, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(feeds),
        })
      }
      if (route.request().method() === 'POST') {
        const newFeed = { id: '2', user_id: 'u1', url: 'https://new.com/feed', title: 'New Feed', site_url: 'https://new.com', last_fetched_at: null, created_at: '2024-01-01' }
        feeds = [newFeed]
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(newFeed),
        })
      }
      return route.continue()
    })

    await page.goto('/feeds')
    await page.waitForSelector('input[type="url"]', { timeout: 15000 })
    await page.fill('input[type="url"]', 'https://new.com/feed')
    await page.click('button:has-text("追加")')
    await expect(page.getByText('New Feed')).toBeVisible({ timeout: 10000 })
  })
})
