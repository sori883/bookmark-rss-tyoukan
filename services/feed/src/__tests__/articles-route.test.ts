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
  }
})

const mockCreateArticle = vi.fn()
const mockListArticles = vi.fn()
const mockGetArticle = vi.fn()
const mockUpdateArticle = vi.fn()
const mockDeleteArticle = vi.fn()
vi.mock('../services/article-service.js', () => ({
  createArticle: (...args: unknown[]) => mockCreateArticle(...args),
  listArticles: (...args: unknown[]) => mockListArticles(...args),
  getArticle: (...args: unknown[]) => mockGetArticle(...args),
  updateArticle: (...args: unknown[]) => mockUpdateArticle(...args),
  deleteArticle: (...args: unknown[]) => mockDeleteArticle(...args),
}))

import { Hono } from 'hono'
import { errorResponse } from '../lib/errors.js'
import articlesRoute from '../routes/articles.js'

function createApp() {
  const app = new Hono()
  app.route('/articles', articlesRoute)
  app.onError((err, c) => errorResponse(c, err))
  return app
}

const NOW = new Date('2025-01-01T00:00:00Z')
const ARTICLE = {
  id: 'art-1',
  userId: 'user-1',
  feedId: 'feed-1',
  url: 'https://example.com/post',
  title: 'Test Post',
  isRead: false,
  publishedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
}

describe('POST /articles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should create article and return 201', async () => {
    mockCreateArticle.mockResolvedValue(ARTICLE)

    const app = createApp()
    const res = await app.request('/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feed_id: 'feed-1',
        url: 'https://example.com/post',
        title: 'Test Post',
        published_at: NOW.toISOString(),
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('art-1')
    expect(body.feed_id).toBe('feed-1')
    expect(body.is_read).toBe(false)
  })
})

describe('GET /articles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return paginated articles', async () => {
    mockListArticles.mockResolvedValue({
      data: [ARTICLE],
      total: 1,
      page: 1,
      limit: 20,
    })

    const app = createApp()
    const res = await app.request('/articles')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
  })

  it('should pass feed_id filter', async () => {
    mockListArticles.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    })

    const app = createApp()
    await app.request('/articles?feed_id=feed-1')

    expect(mockListArticles).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ feedId: 'feed-1' }),
    )
  })

  it('should pass is_read filter', async () => {
    mockListArticles.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    })

    const app = createApp()
    await app.request('/articles?is_read=false')

    expect(mockListArticles).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isRead: false }),
    )
  })
})

describe('GET /articles/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return article detail and auto-mark unread as read', async () => {
    mockGetArticle.mockResolvedValue(ARTICLE) // isRead: false
    mockUpdateArticle.mockResolvedValue({ ...ARTICLE, isRead: true })

    const app = createApp()
    const res = await app.request('/articles/art-1')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('art-1')
    expect(body.is_read).toBe(true)
    expect(mockUpdateArticle).toHaveBeenCalledWith(
      expect.anything(),
      'art-1',
      'user-1',
      { isRead: true },
    )
  })

  it('should not call updateArticle when article is already read', async () => {
    const readArticle = { ...ARTICLE, isRead: true }
    mockGetArticle.mockResolvedValue(readArticle)

    const app = createApp()
    const res = await app.request('/articles/art-1')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('art-1')
    expect(body.is_read).toBe(true)
    expect(mockUpdateArticle).not.toHaveBeenCalled()
  })

  it('should return 404 for non-existent article', async () => {
    const { NotFoundError } = await import('../lib/errors.js')
    mockGetArticle.mockRejectedValue(new NotFoundError('Article not found'))

    const app = createApp()
    const res = await app.request('/articles/bad-id')

    expect(res.status).toBe(404)
  })
})

describe('PATCH /articles/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should update article is_read', async () => {
    mockUpdateArticle.mockResolvedValue({ ...ARTICLE, isRead: true })

    const app = createApp()
    const res = await app.request('/articles/art-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.is_read).toBe(true)
  })
})

describe('DELETE /articles/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return 204', async () => {
    mockDeleteArticle.mockResolvedValue(undefined)

    const app = createApp()
    const res = await app.request('/articles/art-1', { method: 'DELETE' })

    expect(res.status).toBe(204)
  })
})
