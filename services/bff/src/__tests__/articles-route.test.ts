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

const mockListArticles = vi.fn()
const mockGetArticle = vi.fn()
const mockUpdateArticle = vi.fn()

vi.mock('../services/feed-client.js', () => ({
  listArticles: (...args: unknown[]) => mockListArticles(...args),
  getArticle: (...args: unknown[]) => mockGetArticle(...args),
  updateArticle: (...args: unknown[]) => mockUpdateArticle(...args),
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

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('GET /articles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should forward query params to feed service', async () => {
    const articles = { data: [], total: 0, page: 1, limit: 20 }
    mockListArticles.mockResolvedValue(jsonResponse(articles))

    const app = createApp()
    const res = await app.request('/articles?feed_id=f1&is_read=false&page=2', {
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.status).toBe(200)
    expect(mockListArticles).toHaveBeenCalledWith(
      'test-token',
      expect.stringContaining('feed_id=f1'),
    )
  })
})

describe('GET /articles/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should get article and mark as read', async () => {
    const article = { id: 'a1', title: 'Test', is_read: false }
    mockGetArticle.mockResolvedValue(jsonResponse(article))
    mockUpdateArticle.mockResolvedValue(jsonResponse({ ...article, is_read: true }))

    const app = createApp()
    const res = await app.request('/articles/a1', {
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('a1')
    expect(mockUpdateArticle).toHaveBeenCalledWith('test-token', 'a1', {
      is_read: true,
    })
  })

  it('should not update if already read', async () => {
    const article = { id: 'a1', title: 'Test', is_read: true }
    mockGetArticle.mockResolvedValue(jsonResponse(article))

    const app = createApp()
    const res = await app.request('/articles/a1', {
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.status).toBe(200)
    expect(mockUpdateArticle).not.toHaveBeenCalled()
  })

  it('should forward 404 from feed service', async () => {
    mockGetArticle.mockResolvedValue(
      jsonResponse({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404),
    )

    const app = createApp()
    const res = await app.request('/articles/bad-id', {
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.status).toBe(404)
  })
})
