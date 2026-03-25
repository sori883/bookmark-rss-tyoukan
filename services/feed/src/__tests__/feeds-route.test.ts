import { vi } from 'vitest'

// モジュールモック
vi.mock('../lib/db.js', () => ({ db: {} }))
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('../middleware/auth.js', () => {
  const { createMiddleware } = require('hono/factory')
  return {
    authMiddleware: createMiddleware(async (c: any, next: any) => {
      c.set('jwtPayload', { sub: 'user-1' })
      await next()
    }),
    getUserId: (payload: { sub: string }) => payload.sub,
  }
})

const mockCreateFeed = vi.fn()
const mockListFeeds = vi.fn()
const mockDeleteFeed = vi.fn()
const mockImportOpml = vi.fn()
const mockGetFeedById = vi.fn()
vi.mock('../services/feed-service.js', () => ({
  createFeed: (...args: unknown[]) => mockCreateFeed(...args),
  listFeeds: (...args: unknown[]) => mockListFeeds(...args),
  deleteFeed: (...args: unknown[]) => mockDeleteFeed(...args),
  importOpml: (...args: unknown[]) => mockImportOpml(...args),
  getFeedById: (...args: unknown[]) => mockGetFeedById(...args),
}))

const mockFetchFeeds = vi.fn()
vi.mock('../services/rss-fetcher.js', () => ({
  fetchFeeds: (...args: unknown[]) => mockFetchFeeds(...args),
}))

const mockParseOpml = vi.fn()
vi.mock('../lib/opml-parser.js', () => ({
  parseOpml: (...args: unknown[]) => mockParseOpml(...args),
}))

import { Hono } from 'hono'
import { errorResponse } from '../lib/errors.js'
import feedsRoute from '../routes/feeds.js'

function createApp() {
  const app = new Hono()
  app.route('/feeds', feedsRoute)
  app.onError((err, c) => errorResponse(c, err))
  return app
}

const NOW = new Date('2025-01-01T00:00:00Z')

describe('POST /feeds', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should create feed, run initial fetch, and return 201', async () => {
    const feedData = {
      id: 'feed-1',
      userId: 'user-1',
      url: 'https://example.com/rss',
      title: 'Example',
      siteUrl: 'https://example.com',
      lastFetchedAt: null,
      createdAt: NOW,
    }
    mockCreateFeed.mockResolvedValue(feedData)
    mockFetchFeeds.mockResolvedValue({ fetchedCount: 1, newArticlesCount: 3 })
    mockGetFeedById.mockResolvedValue(feedData)

    const app = createApp()
    const res = await app.request('/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/rss' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('feed-1')
    expect(body.user_id).toBe('user-1')
    expect(body.url).toBe('https://example.com/rss')
    expect(body.last_fetched_at).toBeNull()
    expect(mockFetchFeeds).toHaveBeenCalledWith(
      expect.anything(),
      'feed-1',
      'user-1',
    )
  })

  it('should return 400 for invalid URL', async () => {
    const app = createApp()
    const res = await app.request('/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'not-a-url' }),
    })

    expect(res.status).toBe(400)
  })
})

describe('GET /feeds', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return feed list', async () => {
    mockListFeeds.mockResolvedValue([
      {
        id: 'feed-1',
        userId: 'user-1',
        url: 'https://example.com/rss',
        title: 'Example',
        siteUrl: 'https://example.com',
        lastFetchedAt: NOW,
        createdAt: NOW,
      },
    ])

    const app = createApp()
    const res = await app.request('/feeds')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('feed-1')
    expect(body[0].last_fetched_at).toBe(NOW.toISOString())
  })
})

describe('DELETE /feeds/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return 204 on success', async () => {
    mockDeleteFeed.mockResolvedValue(undefined)

    const app = createApp()
    const res = await app.request('/feeds/feed-1', { method: 'DELETE' })

    expect(res.status).toBe(204)
    expect(mockDeleteFeed).toHaveBeenCalledWith(
      expect.anything(),
      'feed-1',
      'user-1',
    )
  })

  it('should return 404 for non-existent feed', async () => {
    const { NotFoundError } = await import('../lib/errors.js')
    mockDeleteFeed.mockRejectedValue(new NotFoundError('Feed not found'))

    const app = createApp()
    const res = await app.request('/feeds/bad-id', { method: 'DELETE' })

    expect(res.status).toBe(404)
  })
})

describe('POST /feeds/fetch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return fetch results', async () => {
    mockFetchFeeds.mockResolvedValue({
      fetchedCount: 3,
      newArticlesCount: 10,
    })

    const app = createApp()
    const res = await app.request('/feeds/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.fetched_count).toBe(3)
    expect(body.new_articles_count).toBe(10)
  })

  it('should pass feed_id when specified', async () => {
    mockFetchFeeds.mockResolvedValue({
      fetchedCount: 1,
      newArticlesCount: 5,
    })

    const app = createApp()
    const res = await app.request('/feeds/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feed_id: 'feed-1' }),
    })

    expect(res.status).toBe(200)
    expect(mockFetchFeeds).toHaveBeenCalledWith(
      expect.anything(),
      'feed-1',
      'user-1',
    )
  })
})

describe('POST /feeds/import-opml', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should import feeds from OPML file', async () => {
    mockParseOpml.mockReturnValue([
      {
        url: 'https://example.com/rss',
        title: 'Example Feed',
        siteUrl: 'https://example.com',
      },
    ])
    mockImportOpml.mockResolvedValue([
      {
        id: 'feed-1',
        userId: 'user-1',
        url: 'https://example.com/rss',
        title: 'Example Feed',
        siteUrl: 'https://example.com',
        lastFetchedAt: null,
        createdAt: NOW,
      },
    ])

    const opml = '<opml><body><outline xmlUrl="https://example.com/rss" /></body></opml>'

    const formData = new FormData()
    formData.append('file', new File([opml], 'feeds.opml', { type: 'text/xml' }))

    const app = createApp()
    const res = await app.request('/feeds/import-opml', {
      method: 'POST',
      body: formData,
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.imported_count).toBe(1)
    expect(body.feeds).toHaveLength(1)
    expect(body.feeds[0].url).toBe('https://example.com/rss')
  })

  it('should return 400 when no file provided', async () => {
    const app = createApp()
    const res = await app.request('/feeds/import-opml', {
      method: 'POST',
      body: new FormData(),
    })

    expect(res.status).toBe(400)
  })
})
