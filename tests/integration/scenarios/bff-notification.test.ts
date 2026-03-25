import { describe, it, expect, beforeAll } from 'vitest'
import { loadTestEnv, type TestEnv } from '../helpers/env'
import { generateUserJwt } from '../helpers/jwt-helper'
import { createAuthClient } from '../helpers/http-client'
import { waitForServices } from '../helpers/wait-for-service'

interface NotificationResponse {
  readonly id: string
  readonly user_id: string
  readonly type: 'webhook'
  readonly message: string
  readonly is_read: boolean
  readonly sent_at: string
}

interface PaginatedNotifications {
  readonly data: ReadonlyArray<NotificationResponse>
  readonly total: number
  readonly page: number
  readonly limit: number
}

describe('bff-notification: bff -> notification 結合テスト', () => {
  let env: TestEnv
  let token: string
  let bffClient: ReturnType<typeof createAuthClient>

  beforeAll(async () => {
    env = loadTestEnv()
    await waitForServices([
      { baseUrl: env.BFF_BASE_URL, name: 'bff' },
      { baseUrl: env.NOTIFICATION_BASE_URL, name: 'notification' },
    ])
    token = await generateUserJwt('test-user-1')
    bffClient = createAuthClient(env.BFF_BASE_URL, token)
  })

  describe('GET /notifications', () => {
    it('通知一覧を取得できる', async () => {
      const res =
        await bffClient.get<PaginatedNotifications>('/notifications')

      expect(res.status).toBe(200)
      expect(res.data.data).toBeDefined()
      expect(Array.isArray(res.data.data)).toBe(true)
      expect(typeof res.data.total).toBe('number')
      expect(typeof res.data.page).toBe('number')
      expect(typeof res.data.limit).toBe('number')
    })

    it('ページネーションパラメータを指定できる', async () => {
      const res = await bffClient.get<PaginatedNotifications>(
        '/notifications?page=1&limit=5',
      )

      expect(res.status).toBe(200)
      expect(res.data.limit).toBe(5)
      expect(res.data.page).toBe(1)
    })

    it('通知レスポンスの各フィールドが正しい型を持つ', async () => {
      const res =
        await bffClient.get<PaginatedNotifications>('/notifications')

      expect(res.status).toBe(200)

      if (res.data.data.length > 0) {
        const notification = res.data.data[0]
        expect(typeof notification.id).toBe('string')
        expect(typeof notification.user_id).toBe('string')
        expect(notification.type).toBe('webhook')
        expect(typeof notification.message).toBe('string')
        expect(typeof notification.is_read).toBe('boolean')
        expect(typeof notification.sent_at).toBe('string')
      }
    })
  })

  describe('PATCH /notifications/:id', () => {
    it('通知を既読に更新できる', async () => {
      // まず通知一覧を取得して、更新対象の ID を得る
      const listRes =
        await bffClient.get<PaginatedNotifications>('/notifications')

      expect(listRes.status).toBe(200)

      if (listRes.data.data.length === 0) {
        // 通知が存在しない場合はスキップ
        return
      }

      const targetId = listRes.data.data[0].id

      const patchRes = await bffClient.patch<NotificationResponse>(
        `/notifications/${targetId}`,
        { is_read: true },
      )

      expect(patchRes.status).toBe(200)
      expect(patchRes.data.id).toBe(targetId)
      expect(patchRes.data.is_read).toBe(true)
    })

    it('通知を未読に戻せる', async () => {
      const listRes =
        await bffClient.get<PaginatedNotifications>('/notifications')

      expect(listRes.status).toBe(200)

      if (listRes.data.data.length === 0) {
        return
      }

      const targetId = listRes.data.data[0].id

      // 既読にする
      await bffClient.patch<NotificationResponse>(
        `/notifications/${targetId}`,
        { is_read: true },
      )

      // 未読に戻す
      const patchRes = await bffClient.patch<NotificationResponse>(
        `/notifications/${targetId}`,
        { is_read: false },
      )

      expect(patchRes.status).toBe(200)
      expect(patchRes.data.id).toBe(targetId)
      expect(patchRes.data.is_read).toBe(false)
    })

    it('存在しない通知 ID で 404 を返す', async () => {
      const res = await bffClient.patch(
        '/notifications/00000000-0000-0000-0000-000000000000',
        { is_read: true },
      )

      expect(res.status).toBe(404)
    })
  })
})
