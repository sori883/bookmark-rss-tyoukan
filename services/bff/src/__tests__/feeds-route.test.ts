import { vi, describe, it, expect, beforeEach } from 'vitest'

// モジュールモック
vi.mock('../lib/db.js', () => ({ db: {} }))
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

const mockListFeeds = vi.fn()
const mockCreateFeed = vi.fn()
const mockDeleteFeed = vi.fn()
const mockImportOpml = vi.fn()
const mockFetchFeeds = vi.fn()

vi.mock('../services/feed-client.js', () => ({
  listFeeds: (...args: unknown[]) => mockListFeeds(...args),
  createFeed: (...args: unknown[]) => mockCreateFeed(...args),
  deleteFeed: (...args: unknown[]) => mockDeleteFeed(...args),
  importOpml: (...args: unknown[]) => mockImportOpml(...args),
  fetchFeeds: (...args: unknown[]) => mockFetchFeeds(...args),
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

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('GET /feeds', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return feed list from feed service', async () => {
    const feeds = [{ id: 'feed-1', url: 'https://example.com/rss' }]
    mockListFeeds.mockResolvedValue(jsonResponse(feeds))

    const app = createApp()
    const res = await app.request('/feeds', {
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(feeds)
    expect(mockListFeeds).toHaveBeenCalledWith('test-token')
  })
})

describe('POST /feeds', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should create feed and trigger initial fetch', async () => {
    const created = { id: 'feed-1', url: 'https://example.com/rss' }
    mockCreateFeed.mockResolvedValue(jsonResponse(created, 201))
    mockFetchFeeds.mockResolvedValue(jsonResponse({ fetched_count: 1 }))

    const app = createApp()
    const res = await app.request('/feeds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ url: 'https://example.com/rss' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('feed-1')
    expect(mockCreateFeed).toHaveBeenCalledWith('test-token', {
      url: 'https://example.com/rss',
    })
    expect(mockFetchFeeds).toHaveBeenCalledWith('test-token', 'feed-1')
  })

  it('should return 400 for invalid URL', async () => {
    const app = createApp()
    const res = await app.request('/feeds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ url: 'not-a-url' }),
    })

    expect(res.status).toBe(400)
  })

  it('should forward error from feed service', async () => {
    mockCreateFeed.mockResolvedValue(
      jsonResponse({ error: { code: 'CONFLICT', message: 'Feed exists' } }, 409),
    )

    const app = createApp()
    const res = await app.request('/feeds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ url: 'https://example.com/rss' }),
    })

    expect(res.status).toBe(409)
  })
})

describe('DELETE /feeds/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return 204 on successful deletion', async () => {
    mockDeleteFeed.mockResolvedValue(new Response(null, { status: 204 }))

    const app = createApp()
    const res = await app.request('/feeds/feed-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.status).toBe(204)
    expect(mockDeleteFeed).toHaveBeenCalledWith('test-token', 'feed-1')
  })

  it('should forward 404 from feed service', async () => {
    mockDeleteFeed.mockResolvedValue(
      jsonResponse({ error: { code: 'NOT_FOUND', message: 'Feed not found' } }, 404),
    )

    const app = createApp()
    const res = await app.request('/feeds/bad-id', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.status).toBe(404)
  })
})

describe('POST /feeds/import-opml', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should forward OPML file to feed service', async () => {
    const result = { imported_count: 2, feeds: [] }
    mockImportOpml.mockResolvedValue(jsonResponse(result))

    const formData = new FormData()
    formData.append(
      'file',
      new File(['<opml></opml>'], 'feeds.opml', { type: 'text/xml' }),
    )

    const app = createApp()
    const res = await app.request('/feeds/import-opml', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
      body: formData,
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.imported_count).toBe(2)
  })

  it('should return 400 when no file provided', async () => {
    const app = createApp()
    const res = await app.request('/feeds/import-opml', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
      body: new FormData(),
    })

    expect(res.status).toBe(400)
  })
})
