import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import type { AuthVariables } from '../middleware/auth.js'
import * as feedClient from '../services/feed-client.js'

const app = new Hono<{ Variables: AuthVariables }>()

app.use(authMiddleware)

function getToken(authHeader: string | undefined): string {
  return authHeader?.slice(7) ?? ''
}

// GET /articles
app.get('/', async (c) => {
  const token = getToken(c.req.header('Authorization'))
  const query = c.req.url.split('?')[1] ?? ''

  const res = await feedClient.listArticles(token, query)
  return c.json(await res.json(), res.status as 200)
})

// GET /articles/:id — 詳細取得 + 既読更新
app.get('/:id', async (c) => {
  const token = getToken(c.req.header('Authorization'))
  const id = c.req.param('id')

  const res = await feedClient.getArticle(token, id)
  if (!res.ok) {
    return c.json(await res.json(), res.status as 404)
  }

  const article = await res.json()

  if (!article.is_read) {
    await feedClient.updateArticle(token, id, { is_read: true })
  }

  return c.json(article)
})

export default app
