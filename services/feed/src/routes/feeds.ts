import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { authMiddleware, getUserId } from '../middleware/auth.js'
import type { AuthVariables } from '../middleware/auth.js'
import * as feedService from '../services/feed-service.js'
import * as rssFetcher from '../services/rss-fetcher.js'
import { parseOpml } from '../lib/opml-parser.js'
import { ValidationError } from '../lib/errors.js'

const app = new Hono<{ Variables: AuthVariables }>()

app.use(authMiddleware)

// POST /feeds — フィード登録
app.post(
  '/',
  zValidator(
    'json',
    z.object({
      url: z.string().url(),
    }),
  ),
  async (c) => {
    const { url } = c.req.valid('json')
    const userId = getUserId(c.get('jwtPayload'))

    const feed = await feedService.createFeed(db, { userId, url })

    return c.json(
      {
        id: feed.id,
        user_id: feed.userId,
        url: feed.url,
        title: feed.title,
        site_url: feed.siteUrl,
        last_fetched_at: feed.lastFetchedAt?.toISOString() ?? null,
        created_at: feed.createdAt.toISOString(),
      },
      201,
    )
  },
)

// GET /feeds — フィード一覧
app.get('/', async (c) => {
  const userId = getUserId(c.get('jwtPayload'))
  const feedList = await feedService.listFeeds(db, userId)

  return c.json(
    feedList.map((f) => ({
      id: f.id,
      user_id: f.userId,
      url: f.url,
      title: f.title,
      site_url: f.siteUrl,
      last_fetched_at: f.lastFetchedAt?.toISOString() ?? null,
      created_at: f.createdAt.toISOString(),
    })),
  )
})

// POST /feeds/fetch — RSS定期取得実行
// サービスJWTの場合は全フィード対象、ユーザーJWTの場合は自分のフィードのみ
app.post(
  '/fetch',
  zValidator(
    'json',
    z
      .object({
        feed_id: z.string().optional(),
      })
      .optional(),
  ),
  async (c) => {
    const body = c.req.valid('json')
    const jwtPayload = c.get('jwtPayload')

    const userId =
      jwtPayload.type === 'service' ? undefined : getUserId(jwtPayload)

    const result = await rssFetcher.fetchFeeds(db, body?.feed_id, userId)

    return c.json({
      fetched_count: result.fetchedCount,
      new_articles_count: result.newArticlesCount,
    })
  },
)

// POST /feeds/import-opml — OPMLインポート
app.post('/import-opml', async (c) => {
  const userId = getUserId(c.get('jwtPayload'))
  const body = await c.req.parseBody()
  const file = body.file

  if (!(file instanceof File)) {
    throw new ValidationError('OPML file is required')
  }

  const xml = await file.text()
  const opmlFeeds = parseOpml(xml)

  if (opmlFeeds.length === 0) {
    throw new ValidationError('No feeds found in OPML file')
  }

  const imported = await feedService.importOpml(db, userId, opmlFeeds)

  return c.json({
    imported_count: imported.length,
    feeds: imported.map((f) => ({
      id: f.id,
      user_id: f.userId,
      url: f.url,
      title: f.title,
      site_url: f.siteUrl,
      last_fetched_at: f.lastFetchedAt?.toISOString() ?? null,
      created_at: f.createdAt.toISOString(),
    })),
  })
})

// DELETE /feeds/:id — フィード削除
app.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const userId = getUserId(c.get('jwtPayload'))

  await feedService.deleteFeed(db, id, userId)

  return c.body(null, 204)
})

export default app
