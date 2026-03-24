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

// GET /feeds
app.get('/', async (c) => {
  const token = getToken(c.req.header('Authorization'))
  const res = await feedClient.listFeeds(token)
  return c.json(await res.json(), res.status as 200)
})

// POST /feeds
app.post(
  '/',
  zValidator('json', z.object({ url: z.string().url() })),
  async (c) => {
    const token = getToken(c.req.header('Authorization'))
    const body = c.req.valid('json')

    const createRes = await feedClient.createFeed(token, body)
    if (!createRes.ok) {
      return c.json(await createRes.json(), createRes.status as 400)
    }

    const created = await createRes.json()

    await feedClient.fetchFeeds(token, created.id)

    return c.json(created, 201)
  },
)

// POST /feeds/import-opml
app.post('/import-opml', async (c) => {
  const token = getToken(c.req.header('Authorization'))
  const body = await c.req.parseBody()
  const file = body.file

  if (!(file instanceof File)) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'OPML file is required' } },
      400,
    )
  }

  const formData = new FormData()
  formData.append('file', file)

  const res = await feedClient.importOpml(token, formData)
  return c.json(await res.json(), res.status as 200)
})

// DELETE /feeds/:id
app.delete('/:id', async (c) => {
  const token = getToken(c.req.header('Authorization'))
  const id = c.req.param('id')

  const res = await feedClient.deleteFeed(token, id)
  if (res.status === 204) {
    return c.body(null, 204)
  }
  return c.json(await res.json(), res.status as 404)
})

export default app
