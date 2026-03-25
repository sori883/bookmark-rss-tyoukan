import { test, expect } from '@playwright/test'
import { mockAuth, bffUrl } from './helpers'

test.describe('Notifications', () => {
  test.beforeEach(async ({ context }) => {
    await mockAuth(context)
  })

  test('should display notification list', async ({ page }) => {
    await page.route(`${bffUrl('/notifications')}*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'n1', user_id: 'u1', type: 'webhook', message: 'AI Digest: 3 articles', is_read: false, sent_at: '2024-01-01T09:00:00Z' },
            { id: 'n2', user_id: 'u1', type: 'webhook', message: 'Previous digest', is_read: true, sent_at: '2023-12-31T09:00:00Z' },
          ],
          total: 2,
          page: 1,
          limit: 20,
        }),
      }),
    )

    await page.goto('/notifications')
    await expect(page.getByText('AI Digest: 3 articles')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Previous digest')).toBeVisible()
  })

  test('should mark notification as read', async ({ page }) => {
    await page.route(`${bffUrl('/notifications')}?*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'n1', user_id: 'u1', type: 'webhook', message: 'Unread notification', is_read: false, sent_at: '2024-01-01T09:00:00Z' },
          ],
          total: 1, page: 1, limit: 20,
        }),
      }),
    )
    await page.route(`${bffUrl('/notifications/n1')}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'n1', user_id: 'u1', type: 'webhook', message: 'Unread notification', is_read: true, sent_at: '2024-01-01T09:00:00Z' }),
      }),
    )

    await page.goto('/notifications')
    await page.waitForSelector('button:has-text("既読にする")', { timeout: 15000 })
    await page.click('button:has-text("既読にする")')
  })
})
