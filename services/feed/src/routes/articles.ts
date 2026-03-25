import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { authMiddleware, getUserId, isServiceToken } from '../middleware/auth.js'
import type { AuthVariables } from '../middleware/auth.js'
import * as articleService from '../services/article-service.js'

const app = new Hono<{ Variables: AuthVariables }>()

app.use(authMiddleware)

function toResponse(a: {
  id: string
  userId: string
  feedId: string
  url: string
  title: string
  isRead: boolean
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: a.id,
    user_id: a.userId,
    feed_id: a.feedId,
    url: a.url,
    title: a.title,
    is_read: a.isRead,
    published_at: a.publishedAt?.toISOString() ?? null,
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt.toISOString(),
  }
}

// POST /articles — 記事保存
app.post(
  '/',
  zValidator(
    'json',
    z.object({
      feed_id: z.string(),
      url: z.string(),
      title: z.string(),
      published_at: z.string().datetime(),
    }),
  ),
  async (c) => {
    const body = c.req.valid('json')
    const userId = getUserId(c.get('jwtPayload'))

    const article = await articleService.createArticle(db, {
      userId,
      feedId: body.feed_id,
      url: body.url,
      title: body.title,
      publishedAt: body.published_at,
    })

    return c.json(toResponse(article), 201)
  },
)

// GET /articles — 記事一覧
app.get(
  '/',
  zValidator(
    'query',
    z.object({
      feed_id: z.string().optional(),
      is_read: z
        .string()
        .transform((v) => v === 'true')
        .optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  ),
  async (c) => {
    const query = c.req.valid('query')
    const payload = c.get('jwtPayload')
    // サービスJWT: user_id クエリパラメータで対象ユーザー指定
    // ユーザーJWT: 自身のユーザーID
    const userId = isServiceToken(payload)
      ? c.req.query('user_id')
      : getUserId(payload)

    const result = await articleService.listArticles(db, {
      userId,
      feedId: query.feed_id,
      isRead: query.is_read,
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

// GET /articles/:id — 記事詳細（未読の場合は自動既読更新）
app.get('/:id', async (c) => {
  const id = c.req.param('id')
  const userId = getUserId(c.get('jwtPayload'))

  const article = await articleService.getArticle(db, id, userId)

  // 未読の場合は自動的に既読に更新
  if (!article.isRead) {
    const updated = await articleService.updateArticle(db, id, userId, {
      isRead: true,
    })
    return c.json(toResponse(updated))
  }

  return c.json(toResponse(article))
})

// PATCH /articles/:id — 記事更新（既読）
app.patch(
  '/:id',
  zValidator(
    'json',
    z.object({
      is_read: z.boolean().optional(),
    }),
  ),
  async (c) => {
    const id = c.req.param('id')
    const userId = getUserId(c.get('jwtPayload'))
    const body = c.req.valid('json')

    const article = await articleService.updateArticle(db, id, userId, {
      isRead: body.is_read,
    })

    return c.json(toResponse(article))
  },
)

// DELETE /articles/:id — 記事削除
app.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const userId = getUserId(c.get('jwtPayload'))

  await articleService.deleteArticle(db, id, userId)

  return c.body(null, 204)
})

export default app
