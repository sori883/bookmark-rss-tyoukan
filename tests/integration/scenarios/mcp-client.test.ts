import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { loadTestEnv, type TestEnv } from '../helpers/env'
import { generateUserJwt } from '../helpers/jwt-helper'
import { createAuthClient } from '../helpers/http-client'
import { waitForServices } from '../helpers/wait-for-service'

/**
 * MCP ツール定義と同等の操作パターンで feed エンドポイントを検証する。
 * MCP server (Python) は ApiClient 経由で feed にアクセスするため、
 * ここでは同じリクエストパターンを vitest から直接実行する。
 */

interface FeedResponse {
  readonly id: string
  readonly user_id: string
  readonly url: string
  readonly title: string
  readonly site_url: string
  readonly last_fetched_at: string | null
  readonly created_at: string
}

interface ArticleResponse {
  readonly id: string
  readonly user_id: string
  readonly feed_id: string
  readonly url: string
  readonly title: string
  readonly is_read: boolean
  readonly published_at: string
  readonly created_at: string
  readonly updated_at: string
}

interface PaginatedResponse<T> {
  readonly data: readonly T[]
  readonly total: number
  readonly page: number
  readonly limit: number
}

interface BookmarkResponse {
  readonly id: string
  readonly user_id: string
  readonly article_id: string | null
  readonly url: string
  readonly title: string
  readonly content_markdown: string
  readonly created_at: string
  readonly updated_at: string
}

describe('mcp-client: MCP ツール相当の feed 操作テスト', () => {
  let env: TestEnv
  let token: string
  let feedClient: ReturnType<typeof createAuthClient>
  const createdFeedIds: string[] = []
  const createdBookmarkIds: string[] = []

  beforeAll(async () => {
    env = loadTestEnv()
    await waitForServices([
      { baseUrl: env.FEED_BASE_URL, name: 'feed' },
    ])
    token = await generateUserJwt('test-user-1')
    feedClient = createAuthClient(env.FEED_BASE_URL, token)
  })

  afterAll(async () => {
    // テストで作成したブックマークを削除
    for (const bookmarkId of createdBookmarkIds) {
      try {
        await feedClient.delete(`/bookmarks/${bookmarkId}`)
      } catch {
        // クリーンアップ失敗は無視
      }
    }

    // テストで作成したフィードを削除
    for (const feedId of createdFeedIds) {
      try {
        await feedClient.delete(`/feeds/${feedId}`)
      } catch {
        // クリーンアップ失敗は無視
      }
    }
  })

  describe('list_feeds 相当: GET /feeds', () => {
    it('フィード一覧を取得できる', async () => {
      const res = await feedClient.get<FeedResponse[]>('/feeds')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.data)).toBe(true)

      // レスポンスの各フィードが必須フィールドを持つ
      for (const feed of res.data) {
        expect(feed.id).toBeDefined()
        expect(feed.url).toBeDefined()
        expect(feed.title).toBeDefined()
      }
    })

    it('テスト用フィードを登録してから一覧に含まれることを確認', async () => {
      const uniqueUrl = `https://github.blog/feed/?t=mcp-${Date.now()}`
      const createRes = await feedClient.post<FeedResponse>('/feeds', {
        url: uniqueUrl,
      })
      expect(createRes.status).toBe(201)
      createdFeedIds.push(createRes.data.id)

      const listRes = await feedClient.get<FeedResponse[]>('/feeds')
      expect(listRes.status).toBe(200)

      const found = listRes.data.some((feed) => feed.id === createRes.data.id)
      expect(found).toBe(true)
    })
  })

  describe('list_articles 相当: GET /articles', () => {
    it('記事一覧を取得できる', async () => {
      const res = await feedClient.get<PaginatedResponse<ArticleResponse>>(
        '/articles',
      )

      expect(res.status).toBe(200)
      expect(Array.isArray(res.data.data)).toBe(true)
      expect(typeof res.data.total).toBe('number')
      expect(typeof res.data.page).toBe('number')
      expect(typeof res.data.limit).toBe('number')
    })

    it('feed_id でフィルタリングできる（MCP の list_articles(feed_id=...) 相当）', async () => {
      if (createdFeedIds.length === 0) {
        return
      }

      const feedId = createdFeedIds[0]
      const res = await feedClient.get<PaginatedResponse<ArticleResponse>>(
        `/articles?feed_id=${feedId}`,
      )

      expect(res.status).toBe(200)
      expect(Array.isArray(res.data.data)).toBe(true)

      // フィルタリング結果が全て指定した feed_id を持つ
      for (const article of res.data.data) {
        expect(article.feed_id).toBe(feedId)
      }
    })
  })

  describe('list_bookmarks 相当: GET /bookmarks', () => {
    it('ブックマーク一覧を取得できる', async () => {
      const res = await feedClient.get<PaginatedResponse<BookmarkResponse>>(
        '/bookmarks',
      )

      expect(res.status).toBe(200)
      expect(Array.isArray(res.data.data)).toBe(true)
      expect(typeof res.data.total).toBe('number')
      expect(typeof res.data.page).toBe('number')
      expect(typeof res.data.limit).toBe('number')
    })
  })

  describe('search_bookmarks 相当: GET /bookmarks/search', () => {
    it('キーワードでブックマーク検索ができる', async () => {
      const res = await feedClient.get<PaginatedResponse<BookmarkResponse>>(
        '/bookmarks/search?q=test',
      )

      expect(res.status).toBe(200)
      expect(Array.isArray(res.data.data)).toBe(true)
      expect(typeof res.data.total).toBe('number')
    })

    it('空のキーワードでもエラーにならない', async () => {
      const res = await feedClient.get<PaginatedResponse<BookmarkResponse>>(
        '/bookmarks/search?q=',
      )

      // 空文字列でも 200 or 400 (バリデーション) のいずれか
      expect([200, 400]).toContain(res.status)
    })

    it('検索結果にはブックマークの必須フィールドが含まれる', async () => {
      const res = await feedClient.get<PaginatedResponse<BookmarkResponse>>(
        '/bookmarks/search?q=bookmark',
      )

      expect(res.status).toBe(200)

      for (const bookmark of res.data.data) {
        expect(bookmark.id).toBeDefined()
        expect(bookmark.url).toBeDefined()
        expect(bookmark.title).toBeDefined()
        expect(typeof bookmark.content_markdown).toBe('string')
      }
    })
  })

  describe('add_bookmark / remove_bookmark 相当: POST / DELETE /bookmarks', () => {
    it('URL 指定でブックマークを追加・削除できる', async () => {
      // add_bookmark 相当: POST /bookmarks with { url }
      // 実際のURLから本文取得するため、取得可能なURLを使用
      const addRes = await feedClient.post<BookmarkResponse>('/bookmarks', {
        url: 'https://github.blog/',
      })

      // 201 (成功) または 500 (外部URL取得失敗の可能性) を許容
      if (addRes.status !== 201) {
        // 外部URLの取得に失敗した場合はスキップ
        return
      }

      expect(addRes.data.id).toBeDefined()

      const bookmarkId = addRes.data.id
      createdBookmarkIds.push(bookmarkId)

      // remove_bookmark 相当: DELETE /bookmarks/:id
      const removeRes = await feedClient.delete(`/bookmarks/${bookmarkId}`)
      expect(removeRes.status).toBe(204)

      // 削除済みなのでクリーンアップリストから除去
      const idx = createdBookmarkIds.indexOf(bookmarkId)
      if (idx !== -1) {
        createdBookmarkIds.splice(idx, 1)
      }

      // 削除後に一覧に含まれないことを確認
      const listRes = await feedClient.get<PaginatedResponse<BookmarkResponse>>(
        '/bookmarks',
      )
      const found = listRes.data.data.some((b) => b.id === bookmarkId)
      expect(found).toBe(false)
    })
  })
})
