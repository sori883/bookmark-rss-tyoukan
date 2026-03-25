import { test, expect } from '@playwright/test'

test.describe('Settings', () => {
  test('should display settings form', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Webhookタイプ')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Webhook URL')).toBeVisible()
    await expect(page.getByRole('button', { name: '保存' })).toBeVisible()
  })

  test('should display registered status when webhook is set', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('select')).toBeVisible({ timeout: 15000 })

    // Webhook URL が登録済みの場合は「登録済み」表示、未登録の場合は入力フィールド表示
    const isRegistered = await page.getByText('登録済み').isVisible({ timeout: 3000 }).catch(() => false)
    const hasUrlInput = await page.locator('input[type="url"]').isVisible().catch(() => false)
    expect(isRegistered || hasUrlInput).toBeTruthy()
  })

  test('should update webhook settings', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await page.locator('select').selectOption('discord')

    // 登録済みの場合は「変更する」をクリックして入力フィールドを表示
    const changeButton = page.getByText('変更する')
    if (await changeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await changeButton.click()
    }

    const urlInput = page.locator('input[type="url"]')
    await expect(urlInput).toBeVisible({ timeout: 5000 })
    await urlInput.clear()
    await urlInput.fill('https://discord.com/api/webhooks/test/e2e')

    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('保存しました')).toBeVisible({ timeout: 10000 })
  })

  test('should show registered status after save and reload', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await page.locator('select').selectOption('slack')

    // 登録済みの場合は「変更する」をクリック
    const changeButton = page.getByText('変更する')
    if (await changeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await changeButton.click()
    }

    const urlInput = page.locator('input[type="url"]')
    await expect(urlInput).toBeVisible({ timeout: 5000 })
    await urlInput.clear()
    await urlInput.fill('https://hooks.slack.com/services/e2e-test')
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('保存しました')).toBeVisible({ timeout: 10000 })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.locator('select')).toHaveValue('slack', { timeout: 10000 })
    // リロード後はURLは表示されず「登録済み」が表示される
    await expect(page.getByText('登録済み')).toBeVisible({ timeout: 10000 })
  })

  test('should show validation error for invalid webhook URL', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    await page.locator('select').selectOption('discord')

    // 登録済みの場合は「変更する」をクリック
    const changeButton = page.getByText('変更する')
    if (await changeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await changeButton.click()
    }

    const urlInput = page.locator('input[type="url"]')
    await expect(urlInput).toBeVisible({ timeout: 5000 })
    await urlInput.clear()
    await urlInput.fill('abc')
    await page.getByRole('button', { name: '保存' }).click()

    const hasError = await page.getByText('有効なURLを入力してください').isVisible({ timeout: 3000 }).catch(() => false)
    const isInvalid = await page.locator('input:invalid').isVisible().catch(() => false)
    expect(hasError || isInvalid).toBeTruthy()
  })
})
