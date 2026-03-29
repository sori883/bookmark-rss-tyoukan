import { describe, it, expect, vi, beforeAll } from 'vitest'
import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { createServiceTokenRoute } from '../routes/service-token'
import { errorResponse } from '../lib/errors'
import pino from 'pino'
import type { AuthInstance } from '../auth'

// サイレントロガー
const logger = pino({ level: 'silent' })

const MOCK_TOKEN = 'mock-jwt-token'

type MockDb = Parameters<typeof createServiceTokenRoute>[0]

function createMockAuth(): AuthInstance {
  return {
    api: {
      signJWT: vi.fn().mockResolvedValue({ token: MOCK_TOKEN }),
    },
  } as unknown as AuthInstance
}

function createMockDbForInvalidClient(): MockDb {
  const mockLimit = vi.fn().mockReturnValue({
    then: (cb: (rows: unknown[]) => unknown) => Promise.resolve(cb([])),
  })
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })
  return { select: mockSelect } as unknown as MockDb
}

function createMockDbForValidCredentials(
  serviceAccount: Record<string, unknown>,
): MockDb {
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          then: (cb: (rows: unknown[]) => unknown) =>
            Promise.resolve(cb([serviceAccount])),
        }),
      }),
    }),
  })
  return { select: mockSelect } as unknown as MockDb
}

describe('POST /auth/service-token', () => {
  it('should return 401 for invalid client_id', async () => {
    const db = createMockDbForInvalidClient()
    const auth = createMockAuth()
    const route = createServiceTokenRoute(db, auth, logger)

    const app = new Hono()
    app.onError((err, c) => errorResponse(c, err))
    app.route('/auth', route)

    const res = await app.request('/auth/service-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: 'unknown',
        client_secret: 'test-secret',
      }),
    })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('should return service JWT for valid credentials', async () => {
    const hashedSecret = await bcrypt.hash('valid-secret', 10)

    const db = createMockDbForValidCredentials({
      id: 'sa-1',
      serviceName: 'feed',
      clientId: 'feed-client',
      clientSecretHash: hashedSecret,
      createdAt: new Date(),
    })

    const auth = createMockAuth()
    const route = createServiceTokenRoute(db, auth, logger)

    const app = new Hono()
    app.onError((err, c) => errorResponse(c, err))
    app.route('/auth', route)

    const res = await app.request('/auth/service-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: 'feed-client',
        client_secret: 'valid-secret',
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.token_type).toBe('Bearer')
    expect(body.expires_in).toBe(86400)
    expect(body.access_token).toBe(MOCK_TOKEN)

    // auth.api.signJWT が正しいペイロードで呼ばれたことを検証
    expect(auth.api.signJWT).toHaveBeenCalledWith({
      body: {
        payload: {
          sub: 'sa-1',
          iss: 'bookmark-rss-auth',
          type: 'service',
          service_name: 'feed',
          client_id: 'feed-client',
        },
        overrideOptions: {
          jwt: {
            expirationTime: '86400s',
          },
        },
      },
    })
  })

  it('should return 400 for missing fields', async () => {
    const db = createMockDbForInvalidClient()
    const auth = createMockAuth()
    const route = createServiceTokenRoute(db, auth, logger)

    const app = new Hono()
    app.route('/auth', route)

    const res = await app.request('/auth/service-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: 'test' }),
    })

    expect(res.status).toBe(400)
  })
})
