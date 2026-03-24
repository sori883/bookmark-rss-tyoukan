import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import type { AuthVariables } from '../middleware/auth.js'
import * as notificationClient from '../services/notification-client.js'

const app = new Hono<{ Variables: AuthVariables }>()

app.use(authMiddleware)

function getToken(authHeader: string | undefined): string {
  return authHeader?.slice(7) ?? ''
}

// GET /notifications
app.get('/', async (c) => {
  const token = getToken(c.req.header('Authorization'))
  const query = c.req.url.split('?')[1] ?? ''

  const res = await notificationClient.listNotifications(token, query)
  return c.json(await res.json(), res.status as 200)
})

// PATCH /notifications/:id
app.patch(
  '/:id',
  zValidator('json', z.object({ is_read: z.boolean() })),
  async (c) => {
    const token = getToken(c.req.header('Authorization'))
    const id = c.req.param('id')
    const body = c.req.valid('json')

    const res = await notificationClient.updateNotification(token, id, body)
    return c.json(await res.json(), res.status as 200)
  },
)

export default app
