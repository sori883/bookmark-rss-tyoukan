import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import type { AuthVariables } from '../middleware/auth.js'
import * as feedClient from '../services/feed-client.js'

const app = new Hono<{ Variables: AuthVariables }>()

app.use(authMiddleware)

function getToken(authHeader: string | undefined): string {
  return authHeader?.slice(7) ?? ''
}

// GET /bookmarks/search — 全文検索（/:id より先に定義）
app.get('/search', async (c) => {
  const token = getToken(c.req.header('Authorization'))
  const query = c.req.url.split('?')[1] ?? ''

  const res = await feedClient.searchBookmarks(token, query)
  return c.json(await res.json(), res.status as 200)
})

// GET /bookmarks
app.get('/', async (c) => {
  const token = getToken(c.req.header('Authorization'))
  const query = c.req.url.split('?')[1] ?? ''

  const res = await feedClient.listBookmarks(token, query)
  return c.json(await res.json(), res.status as 200)
})

// GET /bookmarks/:id
app.get('/:id', async (c) => {
  const token = getToken(c.req.header('Authorization'))
  const id = c.req.param('id')

  const res = await feedClient.getBookmark(token, id)
  return c.json(await res.json(), res.status as 200)
})

// POST /bookmarks
app.post(
  '/',
  zValidator(
    'json',
    z
      .object({
        article_id: z.string().optional(),
        url: z.string().optional(),
      })
      .refine((data) => data.article_id || data.url, {
        message: 'article_id or url is required',
      }),
  ),
  async (c) => {
    const token = getToken(c.req.header('Authorization'))
    const body = c.req.valid('json')

    const res = await feedClient.createBookmark(token, body)
    return c.json(await res.json(), res.status as 201)
  },
)

// DELETE /bookmarks/:id
app.delete('/:id', async (c) => {
  const token = getToken(c.req.header('Authorization'))
  const id = c.req.param('id')

  const res = await feedClient.deleteBookmark(token, id)
  if (res.status === 204) {
    return c.body(null, 204)
  }
  return c.json(await res.json(), res.status as 404)
})

export default app
