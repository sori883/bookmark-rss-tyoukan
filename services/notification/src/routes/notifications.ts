import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppDb } from '../lib/db'
import type pino from 'pino'
import type { JwtPayload } from '../middleware/auth'
import { UnauthorizedError, ValidationError } from '../lib/errors'
import {
  createNotification,
  listNotifications,
  markAsRead,
} from '../services/notification-service'

type Env = { Variables: { jwtPayload: JwtPayload } }

const notifyRequestSchema = z.object({
  user_id: z.string().min(1),
  message: z.string().min(1),
  webhook_message: z.string().min(1).optional(),
})

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  is_read: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
})

const updateRequestSchema = z.object({
  is_read: z.boolean(),
})

const idParamSchema = z.string().min(1)

function formatNotification(row: {
  id: string
  userId: string
  type: string
  message: string
  isRead: boolean
  sentAt: Date
}) {
  return {
    id: row.id,
    user_id: row.userId,
    type: row.type,
    message: row.message,
    is_read: row.isRead,
    sent_at: row.sentAt.toISOString(),
  }
}

export function createNotificationRoutes(db: AppDb, logger: pino.Logger) {
  const app = new Hono<Env>()

  // POST /notify - 通知送信（サービスJWTのみ）
  app.post('/notify', zValidator('json', notifyRequestSchema), async (c) => {
    const jwt = c.get('jwtPayload')
    if (jwt.type !== 'service') {
      throw new UnauthorizedError('Service token required')
    }

    const { user_id, message, webhook_message } = c.req.valid('json')

    const result = await createNotification(
      db,
      { userId: user_id, message, webhookMessage: webhook_message },
      logger,
    )

    return c.json(
      { id: result.id, webhook_sent: result.webhookSent },
      201,
    )
  })

  // GET /notifications - 通知履歴一覧
  app.get('/notifications', zValidator('query', listQuerySchema), async (c) => {
    const jwt = c.get('jwtPayload')
    const { page, limit, is_read } = c.req.valid('query')

    const result = await listNotifications(db, {
      userId: jwt.sub,
      page,
      limit,
      isRead: is_read,
    })

    return c.json({
      data: result.data.map(formatNotification),
      total: result.total,
      page: result.page,
      limit: result.limit,
    })
  })

  // PATCH /notifications/:id - 通知既読
  app.patch(
    '/notifications/:id',
    zValidator('json', updateRequestSchema),
    async (c) => {
      const jwt = c.get('jwtPayload')
      const id = c.req.param('id')

      const parseResult = idParamSchema.safeParse(id)
      if (!parseResult.success) {
        throw new ValidationError('Invalid notification ID format')
      }

      const { is_read } = c.req.valid('json')
      const updated = await markAsRead(db, id, jwt.sub, is_read)

      return c.json(formatNotification(updated))
    },
  )

  return app
}
