import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { settings } from '@bookmark-rss/db'
import { db } from '../lib/db.js'
import { authMiddleware, getUserId, isServiceToken } from '../middleware/auth.js'
import type { AuthVariables } from '../middleware/auth.js'
import { isNotNull } from 'drizzle-orm'

const app = new Hono<{ Variables: AuthVariables }>()

app.use(authMiddleware)

// GET /settings/notification-targets — サービスJWT専用: Webhook設定済みユーザー一覧
app.get('/notification-targets', async (c) => {
  const payload = c.get('jwtPayload')
  if (!isServiceToken(payload)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Service token required' } }, 403)
  }

  const rows = await db
    .select({
      userId: settings.userId,
      webhookUrl: settings.webhookUrl,
      webhookType: settings.webhookType,
      notificationHour: settings.notificationHour,
    })
    .from(settings)
    .where(isNotNull(settings.webhookUrl))

  return c.json({
    data: rows
      .filter((r) => r.webhookUrl)
      .map((r) => ({
        user_id: r.userId,
        webhook_url: r.webhookUrl,
        webhook_type: r.webhookType,
        notification_hour: r.notificationHour,
      })),
  })
})

// GET /settings
app.get('/', async (c) => {
  const userId = getUserId(c.get('jwtPayload'))

  const rows = await db
    .select({
      webhookUrl: settings.webhookUrl,
      webhookType: settings.webhookType,
      notificationHour: settings.notificationHour,
    })
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1)

  const row = rows[0]

  return c.json({
    webhook_url_registered: Boolean(row?.webhookUrl),
    webhook_type: row?.webhookType ?? null,
    notification_hour: row?.notificationHour ?? 9,
  })
})

// PUT /settings
app.put(
  '/',
  zValidator(
    'json',
    z.object({
      webhook_url: z.string().url().refine(
        (url) => url.startsWith('https://'),
        { message: 'Webhook URL must use HTTPS' },
      ).optional(),
      webhook_type: z.enum(['slack', 'discord']).optional(),
      notification_hour: z.number().int().min(0).max(23).optional(),
    }),
  ),
  async (c) => {
    const userId = getUserId(c.get('jwtPayload'))
    const body = c.req.valid('json')

    const rows = await db
      .select({ id: settings.id })
      .from(settings)
      .where(eq(settings.userId, userId))
      .limit(1)

    if (rows[0]) {
      await db
        .update(settings)
        .set({
          ...(body.webhook_url !== undefined ? { webhookUrl: body.webhook_url } : {}),
          ...(body.webhook_type !== undefined ? { webhookType: body.webhook_type } : {}),
          ...(body.notification_hour !== undefined ? { notificationHour: body.notification_hour } : {}),
          updatedAt: new Date(),
        })
        .where(eq(settings.userId, userId))
    } else {
      await db.insert(settings).values({
        userId,
        webhookUrl: body.webhook_url ?? null,
        webhookType: body.webhook_type ?? null,
        notificationHour: body.notification_hour ?? 9,
      })
    }

    const updated = await db
      .select({
        webhookUrl: settings.webhookUrl,
        webhookType: settings.webhookType,
        notificationHour: settings.notificationHour,
      })
      .from(settings)
      .where(eq(settings.userId, userId))
      .limit(1)

    return c.json({
      webhook_url_registered: Boolean(updated[0]?.webhookUrl),
      webhook_type: updated[0]?.webhookType ?? null,
      notification_hour: updated[0]?.notificationHour ?? 9,
    })
  },
)

export default app
