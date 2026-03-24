import { vi, describe, it, expect, beforeEach } from 'vitest'

// DBモック
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockSet = vi.fn()
const mockValues = vi.fn()

function createSelectChain(result: unknown[]) {
  mockLimit.mockResolvedValue(result)
  mockWhere.mockReturnValue({ limit: mockLimit })
  mockFrom.mockReturnValue({ where: mockWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

vi.mock('../lib/db.js', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}))

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

vi.mock('@bookmark-rss/db', () => ({
  settings: {
    id: 'id',
    userId: 'user_id',
    webhookUrl: 'webhook_url',
    webhookType: 'webhook_type',
    updatedAt: 'updated_at',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: (col: string, val: string) => ({ col, val }),
}))

import { Hono } from 'hono'
import { errorResponse } from '../lib/errors.js'
import settingsRoute from '../routes/settings.js'

function createApp() {
  const app = new Hono()
  app.route('/settings', settingsRoute)
  app.onError((err, c) => errorResponse(c, err))
  return app
}

describe('GET /settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should return settings when they exist', async () => {
    createSelectChain([
      { webhookUrl: 'https://hooks.slack.com/xxx', webhookType: 'slack' },
    ])

    const app = createApp()
    const res = await app.request('/settings', {
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.webhook_url).toBe('https://hooks.slack.com/xxx')
    expect(body.webhook_type).toBe('slack')
  })

  it('should return null values when no settings exist', async () => {
    createSelectChain([])

    const app = createApp()
    const res = await app.request('/settings', {
      headers: { Authorization: 'Bearer test-token' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.webhook_url).toBeNull()
    expect(body.webhook_type).toBeNull()
  })
})

describe('PUT /settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should update existing settings', async () => {
    // First select: check existing
    createSelectChain([{ id: 'settings-1' }])

    // update chain
    const updateWhere = vi.fn().mockResolvedValue(undefined)
    mockSet.mockReturnValue({ where: updateWhere })
    mockUpdate.mockReturnValue({ set: mockSet })

    // After update select
    let callCount = 0
    mockSelect.mockImplementation(() => {
      callCount++
      if (callCount <= 1) {
        return {
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ id: 'settings-1' }]),
            }),
          }),
        }
      }
      return {
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                { webhookUrl: 'https://hooks.slack.com/new', webhookType: 'slack' },
              ]),
          }),
        }),
      }
    })

    const app = createApp()
    const res = await app.request('/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({
        webhook_url: 'https://hooks.slack.com/new',
        webhook_type: 'slack',
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.webhook_url).toBe('https://hooks.slack.com/new')
  })

  it('should create new settings when none exist', async () => {
    // First select: no existing
    createSelectChain([])

    // insert chain
    mockValues.mockResolvedValue(undefined)
    mockInsert.mockReturnValue({ values: mockValues })

    // After insert select
    let callCount = 0
    mockSelect.mockImplementation(() => {
      callCount++
      if (callCount <= 1) {
        return {
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }
      }
      return {
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                {
                  webhookUrl: 'https://discord.com/api/webhooks/xxx',
                  webhookType: 'discord',
                },
              ]),
          }),
        }),
      }
    })

    const app = createApp()
    const res = await app.request('/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({
        webhook_url: 'https://discord.com/api/webhooks/xxx',
        webhook_type: 'discord',
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.webhook_url).toBe('https://discord.com/api/webhooks/xxx')
    expect(body.webhook_type).toBe('discord')
  })

  it('should return 400 for invalid webhook_type', async () => {
    const app = createApp()
    const res = await app.request('/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({
        webhook_url: 'https://example.com',
        webhook_type: 'teams',
      }),
    })

    expect(res.status).toBe(400)
  })
})
