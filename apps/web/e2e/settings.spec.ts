import { test, expect } from '@playwright/test'

test.describe('Settings', () => {
  test('should display settings form', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Webhookタイプ')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Webhook URL')).toBeVisible()
    await expect(page.getByRole('button', { name: '保存' })).toBeVisible()
  })

  test('should display current settings values', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('select')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('input[type="url"]')).toBeVisible()
  })

  test('should update webhook settings', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await page.locator('select').selectOption('discord')

    const urlInput = page.locator('input[type="url"]')
    await urlInput.clear()
    await urlInput.fill('https://discord.com/api/webhooks/test/e2e')

    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('保存しました')).toBeVisible({ timeout: 10000 })
  })

  test('should persist settings after page reload', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await page.locator('select').selectOption('slack')
    const urlInput = page.locator('input[type="url"]')
    await urlInput.clear()
    await urlInput.fill('https://hooks.slack.com/services/e2e-test')
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('保存しました')).toBeVisible({ timeout: 10000 })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.locator('select')).toHaveValue('slack', { timeout: 10000 })
    await expect(page.locator('input[type="url"]')).toHaveValue('https://hooks.slack.com/services/e2e-test')
  })

  test('should show validation error for invalid webhook URL', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await page.locator('select').selectOption('discord')
    const urlInput = page.locator('input[type="url"]')
    await urlInput.clear()
    await urlInput.fill('abc')
    await page.getByRole('button', { name: '保存' }).click()

    const hasError = await page.getByText('有効なURLを入力してください').isVisible({ timeout: 3000 }).catch(() => false)
    const isInvalid = await page.locator('input:invalid').isVisible().catch(() => false)
    expect(hasError || isInvalid).toBeTruthy()
  })
})
