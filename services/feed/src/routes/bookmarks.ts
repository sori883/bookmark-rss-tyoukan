import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { authMiddleware, getUserId, isServiceToken } from '../middleware/auth.js'
import type { AuthVariables } from '../middleware/auth.js'
import * as bookmarkService from '../services/bookmark-service.js'

const app = new Hono<{ Variables: AuthVariables }>()

app.use(authMiddleware)

function toResponse(b: {
  id: string
  userId: string
  articleId: string | null
  url: string
  title: string
  contentMarkdown: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: b.id,
    user_id: b.userId,
    article_id: b.articleId,
    url: b.url,
    title: b.title,
    content_markdown: b.contentMarkdown,
    created_at: b.createdAt.toISOString(),
    updated_at: b.updatedAt.toISOString(),
  }
}

// GET /bookmarks/search — 全文検索（:id より先に定義）
app.get(
  '/search',
  zValidator(
    'query',
    z.object({
      q: z.string().min(1),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  ),
  async (c) => {
    const query = c.req.valid('query')
    const userId = getUserId(c.get('jwtPayload'))

    const result = await bookmarkService.searchBookmarks(db, {
      userId,
      q: query.q,
      page: query.page,
      limit: query.limit,
    })

    return c.json({
      data: result.data.map(toResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
    })
  },
)

// POST /bookmarks — ブックマーク登録
app.post(
  '/',
  zValidator(
    'json',
    z.object({
      article_id: z.string().optional(),
      url: z.string().url().optional(),
    }),
  ),
  async (c) => {
    const body = c.req.valid('json')
    const userId = getUserId(c.get('jwtPayload'))

    const bookmark = await bookmarkService.createBookmark(db, {
      userId,
      articleId: body.article_id,
      url: body.url,
    })

    return c.json(toResponse(bookmark), 201)
  },
)

// GET /bookmarks — ブックマーク一覧（サービスJWT: user_id クエリパラメータ対応）
app.get(
  '/',
  zValidator(
    'query',
    z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  ),
  async (c) => {
    const query = c.req.valid('query')
    const payload = c.get('jwtPayload')
    const userId = isServiceToken(payload)
      ? c.req.query('user_id')
      : getUserId(payload)

    if (!userId) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'user_id is required' } },
        400,
      )
    }

    const result = await bookmarkService.listBookmarks(db, {
      userId,
      page: query.page,
      limit: query.limit,
    })

    return c.json({
      data: result.data.map(toResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
    })
  },
)

// GET /bookmarks/:id — ブックマーク詳細
app.get('/:id', async (c) => {
  const id = c.req.param('id')
  const userId = getUserId(c.get('jwtPayload'))

  const bookmark = await bookmarkService.getBookmark(db, id, userId)

  return c.json(toResponse(bookmark))
})

// DELETE /bookmarks/:id — ブックマーク削除
app.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const userId = getUserId(c.get('jwtPayload'))

  await bookmarkService.deleteBookmark(db, id, userId)

  return c.body(null, 204)
})

export default app
