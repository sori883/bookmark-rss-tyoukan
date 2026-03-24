import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createNotificationRoutes } from '../routes/notifications'
import type { AppDb } from '../lib/db'
import type pino from 'pino'
import type { JwtPayload } from '../middleware/auth'
import { errorResponse, NotFoundError } from '../lib/errors'

vi.mock('../services/notification-service', () => ({
  createNotification: vi.fn(),
  listNotifications: vi.fn(),
  markAsRead: vi.fn(),
}))

import {
  createNotification,
  listNotifications,
  markAsRead,
} from '../services/notification-service'

function createMockLogger(): pino.Logger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  } as unknown as pino.Logger
}

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

function buildTestApp(jwtOverride?: Partial<JwtPayload>) {
  const db = {} as AppDb
  const logger = createMockLogger()

  const app = new Hono<{ Variables: { jwtPayload: JwtPayload } }>()

  // Global error handler
  app.onError((err, c) => {
    return errorResponse(c, err)
  })

  // Mock auth middleware: inject jwtPayload
  app.use('*', async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing Bearer token' } }, 401)
    }
    c.set('jwtPayload', { sub: 'user-1', ...jwtOverride } as JwtPayload)
    await next()
  })

  app.route('/', createNotificationRoutes(db, logger))
  return app
}

describe('POST /notify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 201 on success with service JWT', async () => {
    vi.mocked(createNotification).mockResolvedValue({
      id: 'notif-1',
      webhookSent: true,
    })

    const app = buildTestApp({ type: 'service' })
    const res = await app.request('/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ user_id: TEST_UUID, message: 'test' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual({ id: 'notif-1', webhook_sent: true })
  })

  it('should return 401 when JWT type is not service', async () => {
    const app = buildTestApp() // no type = user JWT
    const res = await app.request('/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ user_id: TEST_UUID, message: 'test' }),
    })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.message).toBe('Service token required')
  })

  it('should return 400 on validation error', async () => {
    const app = buildTestApp({ type: 'service' })
    const res = await app.request('/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })

  it('should return 400 when user_id is not a UUID', async () => {
    const app = buildTestApp({ type: 'service' })
    const res = await app.request('/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ user_id: 'not-a-uuid', message: 'test' }),
    })

    expect(res.status).toBe(400)
  })

  it('should return 401 without auth header', async () => {
    const app = buildTestApp()
    const res = await app.request('/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: TEST_UUID, message: 'test' }),
    })

    expect(res.status).toBe(401)
  })
})

describe('GET /notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 200 with paginated data', async () => {
    const now = new Date('2025-01-01T00:00:00Z')
    vi.mocked(listNotifications).mockResolvedValue({
      data: [
        { id: 'n1', userId: 'user-1', type: 'webhook', message: 'msg', isRead: false, sentAt: now },
      ],
      total: 1,
      page: 1,
      limit: 20,
    })

    const app = buildTestApp()
    const res = await app.request('/notifications', {
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].user_id).toBe('user-1')
    expect(body.data[0].sent_at).toBe('2025-01-01T00:00:00.000Z')
    expect(body.total).toBe(1)
  })

  it('should return 401 without auth header', async () => {
    const app = buildTestApp()
    const res = await app.request('/notifications')

    expect(res.status).toBe(401)
  })
})

describe('PATCH /notifications/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 200 on success', async () => {
    const now = new Date('2025-01-01T00:00:00Z')
    vi.mocked(markAsRead).mockResolvedValue({
      id: TEST_UUID,
      userId: 'user-1',
      type: 'webhook',
      message: 'msg',
      isRead: true,
      sentAt: now,
    })

    const app = buildTestApp()
    const res = await app.request(`/notifications/${TEST_UUID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ is_read: true }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.is_read).toBe(true)
  })

  it('should return 400 when id is not a UUID', async () => {
    const app = buildTestApp()
    const res = await app.request('/notifications/not-a-uuid', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ is_read: true }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('should return 404 when notification not found', async () => {
    vi.mocked(markAsRead).mockRejectedValue(new NotFoundError('Notification not found'))

    const app = buildTestApp()
    const res = await app.request(`/notifications/${TEST_UUID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ is_read: true }),
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('should return 401 without auth header', async () => {
    const app = buildTestApp()
    const res = await app.request(`/notifications/${TEST_UUID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    })

    expect(res.status).toBe(401)
  })
})

describe('GET /health', () => {
  it('should return 200', async () => {
    const { Hono } = await import('hono')
    const app = new Hono()
    app.get('/health', (c) => c.json({ status: 'ok' }))

    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ status: 'ok' })
  })
})
