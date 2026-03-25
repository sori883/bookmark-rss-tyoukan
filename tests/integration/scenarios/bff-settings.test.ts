import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { loadTestEnv, type TestEnv } from '../helpers/env'
import { generateUserJwt } from '../helpers/jwt-helper'
import { createAuthClient } from '../helpers/http-client'
import { waitForService } from '../helpers/wait-for-service'

interface SettingsResponse {
  readonly webhook_url: string | null
  readonly webhook_type: 'slack' | 'discord' | null
}

describe('bff-settings: 設定 CRUD 結合テスト', () => {
  let env: TestEnv
  let token: string
  let bffClient: ReturnType<typeof createAuthClient>
  let originalSettings: SettingsResponse | undefined

  beforeAll(async () => {
    env = loadTestEnv()
    await waitForService(env.BFF_BASE_URL, { serviceName: 'bff' })
    token = await generateUserJwt('test-user-1')
    bffClient = createAuthClient(env.BFF_BASE_URL, token)

    // 元の設定を保存しておく
    const res = await bffClient.get<SettingsResponse>('/settings')
    if (res.ok) {
      originalSettings = res.data
    }
  })

  afterAll(async () => {
    // テスト後に元の設定に戻す
    if (originalSettings) {
      try {
        await bffClient.put('/settings', {
          webhook_url: originalSettings.webhook_url,
          webhook_type: originalSettings.webhook_type,
        })
      } catch {
        // 復元失敗は無視
      }
    }
  })

  describe('GET /settings', () => {
    it('現在のユーザー設定を取得できる', async () => {
      const res = await bffClient.get<SettingsResponse>('/settings')

      expect(res.status).toBe(200)
      expect(res.data).toBeDefined()
      // webhook_url と webhook_type はプロパティとして存在する（null の場合もある）
      expect('webhook_url' in (res.data as Record<string, unknown>)).toBe(true)
      expect('webhook_type' in (res.data as Record<string, unknown>)).toBe(true)
    })
  })

  describe('PUT /settings', () => {
    it('webhook_url と webhook_type を更新できる', async () => {
      const updateRes = await bffClient.put<SettingsResponse>('/settings', {
        webhook_url: 'https://hooks.example.com/test-webhook',
        webhook_type: 'discord',
      })

      expect(updateRes.status).toBe(200)
      expect(updateRes.data.webhook_url).toBe(
        'https://hooks.example.com/test-webhook',
      )
      expect(updateRes.data.webhook_type).toBe('discord')
    })

    it('更新後に GET で更新後の値を確認できる', async () => {
      // 先に更新する
      await bffClient.put<SettingsResponse>('/settings', {
        webhook_url: 'https://hooks.slack.com/test-updated',
        webhook_type: 'slack',
      })

      // GET で確認
      const getRes = await bffClient.get<SettingsResponse>('/settings')

      expect(getRes.status).toBe(200)
      expect(getRes.data.webhook_url).toBe(
        'https://hooks.slack.com/test-updated',
      )
      expect(getRes.data.webhook_type).toBe('slack')
    })

    it('webhook_type を discord に変更できる', async () => {
      const updateRes = await bffClient.put<SettingsResponse>('/settings', {
        webhook_url: 'https://discord.com/api/webhooks/test',
        webhook_type: 'discord',
      })

      expect(updateRes.status).toBe(200)
      expect(updateRes.data.webhook_type).toBe('discord')

      // 再取得して確認
      const getRes = await bffClient.get<SettingsResponse>('/settings')
      expect(getRes.data.webhook_type).toBe('discord')
    })
  })
})
