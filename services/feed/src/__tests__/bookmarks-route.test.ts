import { vi } from 'vitest'

vi.mock('../lib/db.js', () => ({ db: {} }))
vi.mock('../middleware/auth.js', () => {
  const { createMiddleware } = require('hono/factory')
  return {
    authMiddleware: createMiddleware(async (c: any, next: any) => {
      c.set('jwtPayload', { sub: 'user-1' })
      await next()
    }),
    getUserId: (payload: { sub: string }) => payload.sub,
    isServiceToken: () => false,
  }
})

const mockCreateBookmark = vi.fn()
const mockListBookmarks = vi.fn()
const mockGetBookmark = vi.fn()
const mockDeleteBookmark = vi.fn()
const mockSearchBookmarks = vi.fn()
vi.mock('../services/bookmark-service.js', () => ({
  createBookmark: (...args: unknown[]) => mockCreateBookmark(...args),
  listBookmarks: (...args: unknown[]) => mockListBookmarks(...args),
  getBookmark: (...args: unknown[]) => mockGetBookmark(...args),
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

const NOW = new Date('2025-01-01T00:00:00Z')
const BOOKMARK = {
  id: 'bm-1',
  userId: 'user-1',
  articleId: 'art-1',
  url: 'https://example.com/post',
  title: 'Test Post',
  contentMarkdown: '# Test\n\nContent here.',
  searchVector: null,
  createdAt: NOW,
  updatedAt: NOW,
}

describe('POST /bookmarks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should create bookmark with article_id', async () => {
    mockCreateBookmark.mockResolvedValue(BOOKMARK)

    const app = createApp()
    const res = await app.request('/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ article_id: 'art-1' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('bm-1')
    expect(body.article_id).toBe('art-1')
    expect(body.content_markdown).toBe('# Test\n\nContent here.')
  })

  it('should create bookmark with URL', async () => {
    mockCreateBookmark.mockResolvedValue({
      ...BOOKMARK,
      articleId: null,
    })

    const app = createApp()
    const res = await app.request('/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/post' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.article_id).toBeNull()
  })
})

describe('GET /bookmarks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return paginated bookmarks', async () => {
    mockListBookmarks.mockResolvedValue({
      data: [BOOKMARK],
      total: 1,
      page: 1,
      limit: 20,
    })

    const app = createApp()
    const res = await app.request('/bookmarks')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.total).toBe(1)
  })
})

describe('GET /bookmarks/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return bookmark detail', async () => {
    mockGetBookmark.mockResolvedValue(BOOKMARK)

    const app = createApp()
    const res = await app.request('/bookmarks/bm-1')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('bm-1')
    expect(body.content_markdown).toBe('# Test\n\nContent here.')
  })

  it('should return 404 for non-existent bookmark', async () => {
    const { NotFoundError } = await import('../lib/errors.js')
    mockGetBookmark.mockRejectedValue(new NotFoundError('Bookmark not found'))

    const app = createApp()
    const res = await app.request('/bookmarks/bad-id')

    expect(res.status).toBe(404)
  })
})

describe('DELETE /bookmarks/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return 204', async () => {
    mockDeleteBookmark.mockResolvedValue(undefined)

    const app = createApp()
    const res = await app.request('/bookmarks/bm-1', { method: 'DELETE' })

    expect(res.status).toBe(204)
  })
})

describe('GET /bookmarks/search', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return search results', async () => {
    mockSearchBookmarks.mockResolvedValue({
      data: [BOOKMARK],
      total: 1,
      page: 1,
      limit: 20,
    })

    const app = createApp()
    const res = await app.request('/bookmarks/search?q=test')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
  })

  it('should return 400 when q is missing', async () => {
    const app = createApp()
    const res = await app.request('/bookmarks/search')

    expect(res.status).toBe(400)
  })

  it('should return empty data for no matches', async () => {
    mockSearchBookmarks.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    })

    const app = createApp()
    const res = await app.request('/bookmarks/search?q=nonexistent')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(0)
  })
})
