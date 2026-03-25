import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { loadTestEnv, type TestEnv } from '../helpers/env'
import { generateUserJwt } from '../helpers/jwt-helper'
import { createAuthClient } from '../helpers/http-client'
import { waitForServices } from '../helpers/wait-for-service'

interface FeedResponse {
  readonly id: string
  readonly user_id: string
  readonly url: string
  readonly title: string
  readonly site_url: string
  readonly last_fetched_at: string | null
  readonly created_at: string
}

interface PaginatedArticles {
  readonly data: ReadonlyArray<{
    readonly id: string
    readonly user_id: string
    readonly feed_id: string
    readonly url: string
    readonly title: string
    readonly is_read: boolean
    readonly published_at: string
    readonly created_at: string
    readonly updated_at: string
  }>
  readonly total: number
  readonly page: number
  readonly limit: number
}

describe('bff-feed: bff -> feed 結合テスト', () => {
  let env: TestEnv
  let token: string
  let bffClient: ReturnType<typeof createAuthClient>
  const createdFeedIds: string[] = []

  beforeAll(async () => {
    env = loadTestEnv()
    await waitForServices([
      { baseUrl: env.BFF_BASE_URL, name: 'bff' },
      { baseUrl: env.FEED_BASE_URL, name: 'feed' },
    ])
    token = await generateUserJwt('test-user-1')
    bffClient = createAuthClient(env.BFF_BASE_URL, token)
  })

  afterAll(async () => {
    // テストで作成したフィードを bff 経由で削除
    for (const feedId of createdFeedIds) {
      try {
        await bffClient.delete(`/feeds/${feedId}`)
      } catch {
        // クリーンアップ失敗は無視
      }
    }
  })

  describe('POST /feeds', () => {
    it('bff 経由でフィードを登録できる', async () => {
      const res = await bffClient.post<FeedResponse>('/feeds', {
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
  })

  describe('GET /feeds', () => {
    it('bff 経由でフィード一覧を取得できる', async () => {
      const res = await bffClient.get<FeedResponse[]>('/feeds')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.data)).toBe(true)

      // 先ほど作成したフィードが含まれている
      if (createdFeedIds.length > 0) {
        const found = res.data.some((feed) => feed.id === createdFeedIds[0])
        expect(found).toBe(true)
      }
    })
  })

  describe('GET /articles', () => {
    it('bff 経由で記事一覧を取得できる', async () => {
      const res = await bffClient.get<PaginatedArticles>('/articles')

      expect(res.status).toBe(200)
      expect(res.data.data).toBeDefined()
      expect(Array.isArray(res.data.data)).toBe(true)
      expect(typeof res.data.total).toBe('number')
      expect(typeof res.data.page).toBe('number')
      expect(typeof res.data.limit).toBe('number')
    })

    it('ページネーションパラメータを指定できる', async () => {
      const res = await bffClient.get<PaginatedArticles>(
        '/articles?page=1&limit=5',
      )

      expect(res.status).toBe(200)
      expect(res.data.limit).toBe(5)
      expect(res.data.page).toBe(1)
    })

    it('feed_id でフィルタリングできる', async () => {
      if (createdFeedIds.length === 0) {
        return
      }

      const res = await bffClient.get<PaginatedArticles>(
        `/articles?feed_id=${createdFeedIds[0]}`,
      )

      expect(res.status).toBe(200)
      expect(Array.isArray(res.data.data)).toBe(true)
      // フィルタリング結果が全て指定した feed_id を持つ
      for (const article of res.data.data) {
        expect(article.feed_id).toBe(createdFeedIds[0])
      }
    })
  })

  describe('DELETE /feeds/:id', () => {
    it('bff 経由でフィードを削除できる', async () => {
      // 削除用にフィードを作成
      const createRes = await bffClient.post<FeedResponse>('/feeds', {
        url: 'https://feeds.feedburner.com/TheHackersNews',
      })
      expect(createRes.status).toBe(201)
      const feedId = createRes.data.id

      const deleteRes = await bffClient.delete(`/feeds/${feedId}`)
      expect(deleteRes.status).toBe(204)

      // 削除後に一覧に含まれていないことを確認
      const listRes = await bffClient.get<FeedResponse[]>('/feeds')
      const found = listRes.data.some((feed) => feed.id === feedId)
      expect(found).toBe(false)
    })
  })
})
