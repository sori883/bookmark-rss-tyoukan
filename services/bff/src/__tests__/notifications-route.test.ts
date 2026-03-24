import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../lib/db.js', () => ({ db: {} }))
vi.mock('../middleware/auth.js', () => {
  const { createMiddleware } = require('hono/factory')
  return {
    authMiddleware: createMiddleware(async (c: any, next: any) => {
      c.set('jwtPayload', { sub: 'user-1' })
      await next()
    }),
    getUserId: (payload: { sub: string }) => payload.sub,
  }
})

const mockListNotifications = vi.fn()
const mockUpdateNotification = vi.fn()

vi.mock('../services/notification-client.js', () => ({
  listNotifications: (...args: unknown[]) => mockListNotifications(...args),
  updateNotification: (...args: unknown[]) => mockUpdateNotification(...args),
}))

import { Hono } from 'hono'
import { errorResponse } from '../lib/errors.js'
import notificationsRoute from '../routes/notifications.js'

function createApp() {
  const app = new Hono()
  app.route('/notifications', notificationsRoute)
  app.onError((err, c) => errorResponse(c, err))
  return app
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('GET /notifications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return notifications from notification service', async () => {
    const notifications = { data: [], total: 0, page: 1, limit: 20 }
    mockListNotifications.mockResolvedValue(jsonResponse(notifications))

    const app = createApp()
    const res = await app.request('/notifications?page=1&limit=10', {
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(0)
  })
})

describe('PATCH /notifications/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should update notification read status', async () => {
    const updated = { id: 'n1', is_read: true }
    mockUpdateNotification.mockResolvedValue(jsonResponse(updated))

    const app = createApp()
    const res = await app.request('/notifications/n1', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ is_read: true }),
    })

    expect(res.status).toBe(200)
    expect(mockUpdateNotification).toHaveBeenCalledWith('test-token', 'n1', {
      is_read: true,
    })
  })

  it('should return 400 for invalid body', async () => {
    const app = createApp()
    const res = await app.request('/notifications/n1', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ is_read: 'not-boolean' }),
    })

    expect(res.status).toBe(400)
  })
})
