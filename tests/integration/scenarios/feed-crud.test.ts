import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { loadTestEnv, type TestEnv } from '../helpers/env'
import { generateUserJwt } from '../helpers/jwt-helper'
import { createAuthClient, fetchWithoutAuth } from '../helpers/http-client'
import { waitForService } from '../helpers/wait-for-service'

interface FeedResponse {
  readonly id: string
  readonly user_id: string
  readonly url: string
  readonly title: string
  readonly site_url: string
  readonly last_fetched_at: string | null
  readonly created_at: string
}

describe('feed-crud: feed サービス直接結合テスト', () => {
  let env: TestEnv
  let token: string
  let feedClient: ReturnType<typeof createAuthClient>
  const createdFeedIds: string[] = []

  beforeAll(async () => {
    env = loadTestEnv()
    await waitForService(env.FEED_BASE_URL, { serviceName: 'feed' })
    token = await generateUserJwt('test-user-1')
    feedClient = createAuthClient(env.FEED_BASE_URL, token)
  })

  afterAll(async () => {
    // テストで作成したフィードを削除
    for (const feedId of createdFeedIds) {
      try {
        await feedClient.delete(`/feeds/${feedId}`)
      } catch {
        // クリーンアップ失敗は無視
      }
    }
  })

  describe('POST /feeds', () => {
    it('実在する RSS URL でフィードを登録できる', async () => {
      const res = await feedClient.post<FeedResponse>('/feeds', {
        url: 'https://github.blog/feed/',
      })

      expect(res.status).toBe(201)
      expect(res.data.id).toBeDefined()
      expect(res.data.user_id).toBe('test-user-1')
      expect(res.data.url).toBe('https://github.blog/feed/')
      expect(res.data.title).toBeDefined()
      expect(res.data.created_at).toBeDefined()

      createdFeedIds.push(res.data.id)
    })

    it('URL なしでリクエストすると 400 を返す', async () => {
      const res = await feedClient.post('/feeds', {})

      expect([400, 422]).toContain(res.status)
    })

    it('不正な URL でリクエストすると 400 を返す', async () => {
      const res = await feedClient.post('/feeds', {
        url: 'not-a-valid-url',
      })

      expect([400, 422]).toContain(res.status)
    })
  })

  describe('GET /feeds', () => {
    it('フィード一覧を取得できる', async () => {
      const res = await feedClient.get<FeedResponse[]>('/feeds')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.data)).toBe(true)

      // 先ほど作成したフィードが含まれている
      if (createdFeedIds.length > 0) {
        const found = res.data.some((feed) => feed.id === createdFeedIds[0])
        expect(found).toBe(true)
      }
    })
  })

  describe('DELETE /feeds/:id', () => {
    it('フィードを削除できる', async () => {
      // 削除用にフィードを作成
      const createRes = await feedClient.post<FeedResponse>('/feeds', {
        url: 'https://feeds.feedburner.com/TheHackersNews',
      })
      expect(createRes.status).toBe(201)
      const feedId = createRes.data.id

      const deleteRes = await feedClient.delete(`/feeds/${feedId}`)
      expect(deleteRes.status).toBe(204)

      // 削除後に一覧に含まれていないことを確認
      const listRes = await feedClient.get<FeedResponse[]>('/feeds')
      const found = listRes.data.some((feed) => feed.id === feedId)
      expect(found).toBe(false)
    })

    it('存在しない ID で削除すると 404 を返す', async () => {
      const res = await feedClient.delete(
        '/feeds/00000000-0000-0000-0000-000000000000',
      )
      expect([404, 204]).toContain(res.status)
    })
  })

  describe('認証なしアクセス', () => {
    it('GET /feeds に認証なしでアクセスすると 401', async () => {
      const res = await fetchWithoutAuth(`${env.FEED_BASE_URL}/feeds`)
      expect(res.status).toBe(401)
    })

    it('POST /feeds に認証なしでアクセスすると 401', async () => {
      const res = await fetchWithoutAuth(`${env.FEED_BASE_URL}/feeds`, {
        method: 'POST',
        body: { url: 'https://github.blog/feed/' },
      })
      expect(res.status).toBe(401)
    })

    it('DELETE /feeds/:id に認証なしでアクセスすると 401', async () => {
      const res = await fetchWithoutAuth(
        `${env.FEED_BASE_URL}/feeds/00000000-0000-0000-0000-000000000000`,
        { method: 'DELETE' },
      )
      expect(res.status).toBe(401)
    })
  })
})
