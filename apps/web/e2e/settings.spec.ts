import { test, expect } from '@playwright/test'
import { mockAuth, bffUrl } from './helpers'

test.describe('Settings', () => {
  test.beforeEach(async ({ context }) => {
    await mockAuth(context)
  })

  test('should display current settings', async ({ page }) => {
    await page.route(`${bffUrl('/settings')}`, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ webhook_url: 'https://hooks.slack.com/test', webhook_type: 'slack' }),
        })
      }
      return route.continue()
    })

    await page.goto('/settings')
    await page.waitForSelector('input[type="url"]', { timeout: 15000 })
    await expect(page.locator('input[type="url"]')).toHaveValue('https://hooks.slack.com/test')
  })

  test('should save webhook settings', async ({ page }) => {
    await page.route(`${bffUrl('/settings')}`, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ webhook_url: null, webhook_type: null }),
        })
      }
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ webhook_url: 'https://hooks.slack.com/new', webhook_type: 'slack' }),
        })
      }
      return route.continue()
    })

    await page.goto('/settings')
    await page.waitForSelector('select', { timeout: 15000 })
    await page.selectOption('select', 'slack')
    await page.fill('input[type="url"]', 'https://hooks.slack.com/new')
    await page.click('button:has-text("保存")')
    await expect(page.getByText('保存しました')).toBeVisible({ timeout: 10000 })
  })
})
