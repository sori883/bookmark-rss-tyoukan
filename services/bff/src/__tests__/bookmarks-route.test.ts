import { vi, describe, it, expect, beforeEach } from 'vitest'

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

const mockListBookmarks = vi.fn()
const mockGetBookmark = vi.fn()
const mockCreateBookmark = vi.fn()
const mockDeleteBookmark = vi.fn()
const mockSearchBookmarks = vi.fn()

vi.mock('../services/feed-client.js', () => ({
  listBookmarks: (...args: unknown[]) => mockListBookmarks(...args),
  getBookmark: (...args: unknown[]) => mockGetBookmark(...args),
  createBookmark: (...args: unknown[]) => mockCreateBookmark(...args),
  deleteBookmark: (...args: unknown[]) => mockDeleteBookmark(...args),
  searchBookmarks: (...args: unknown[]) => mockSearchBookmarks(...args),
}))

import { Hono } from 'hono'
import { errorResponse } from '../lib/errors.js'
import bookmarksRoute from '../routes/bookmarks.js'

function createApp() {
  const app = new Hono()
  app.route('/bookmarks', bookmarksRoute)
  app.onError((err, c) => errorResponse(c, err))
  return app
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('GET /bookmarks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return bookmark list from feed service', async () => {
    const bookmarks = { data: [], total: 0, page: 1, limit: 20 }
    mockListBookmarks.mockResolvedValue(jsonResponse(bookmarks))

    const app = createApp()
    const res = await app.request('/bookmarks?page=1&limit=10', {
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.status).toBe(200)
    expect(mockListBookmarks).toHaveBeenCalledWith(
      'test-token',
      expect.stringContaining('page=1'),
    )
  })
})

describe('GET /bookmarks/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return bookmark detail', async () => {
    const bookmark = { id: 'b1', title: 'Test', content_markdown: '# Hello' }
    mockGetBookmark.mockResolvedValue(jsonResponse(bookmark))

    const app = createApp()
    const res = await app.request('/bookmarks/b1', {
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('b1')
  })
})

describe('POST /bookmarks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should create bookmark with article_id', async () => {
    const created = { id: 'b1', article_id: 'a1' }
    mockCreateBookmark.mockResolvedValue(jsonResponse(created, 201))

    const app = createApp()
    const res = await app.request('/bookmarks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ article_id: 'a1' }),
    })

    expect(res.status).toBe(201)
    expect(mockCreateBookmark).toHaveBeenCalledWith('test-token', {
      article_id: 'a1',
    })
  })

  it('should create bookmark with url', async () => {
    const created = { id: 'b2', url: 'https://example.com' }
    mockCreateBookmark.mockResolvedValue(jsonResponse(created, 201))

    const app = createApp()
    const res = await app.request('/bookmarks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ url: 'https://example.com' }),
    })

    expect(res.status).toBe(201)
  })

  it('should return 400 when neither article_id nor url provided', async () => {
    const app = createApp()
    const res = await app.request('/bookmarks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })
})

describe('DELETE /bookmarks/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return 204 on successful deletion', async () => {
    mockDeleteBookmark.mockResolvedValue(new Response(null, { status: 204 }))

    const app = createApp()
    const res = await app.request('/bookmarks/b1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.status).toBe(204)
  })
})

describe('GET /bookmarks/search', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should forward search query to feed service', async () => {
    const results = { data: [], total: 0, page: 1, limit: 20 }
    mockSearchBookmarks.mockResolvedValue(jsonResponse(results))

    const app = createApp()
    const res = await app.request('/bookmarks/search?q=test&page=1', {
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.status).toBe(200)
    expect(mockSearchBookmarks).toHaveBeenCalledWith(
      'test-token',
      expect.stringContaining('q=test'),
    )
  })
})
