import { describe, it, expect, vi, beforeAll } from 'vitest'
import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { generateKeyPair, exportJWK, importJWK, jwtVerify } from 'jose'
import { createServiceTokenRoute } from '../routes/service-token'
import { errorResponse } from '../lib/errors'
import pino from 'pino'

// サイレントロガー
const logger = pino({ level: 'silent' })

// テスト用のRSA鍵ペア
let privateKeyJwk: JsonWebKey
let publicKeyJwk: JsonWebKey
const TEST_KID = 'test-key-1'

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256', {
    extractable: true,
  })
  privateKeyJwk = { ...(await exportJWK(privateKey)), alg: 'RS256' }
  publicKeyJwk = { ...(await exportJWK(publicKey)), alg: 'RS256' }
})

type MockDb = Parameters<typeof createServiceTokenRoute>[0]

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
  jwksRow: Record<string, unknown>,
): MockDb {
  let callCount = 0
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // service_accounts
        return {
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (cb: (rows: unknown[]) => unknown) =>
                Promise.resolve(cb([serviceAccount])),
            }),
          }),
        }
      }
      // jwks
      return {
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            then: (cb: (rows: unknown[]) => unknown) =>
              Promise.resolve(cb([jwksRow])),
          }),
        }),
      }
    }),
  })
  return { select: mockSelect } as unknown as MockDb
}

describe('POST /auth/service-token', () => {
  it('should return 401 for invalid client_id', async () => {
    const db = createMockDbForInvalidClient()
    const route = createServiceTokenRoute(db, logger)

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

    const db = createMockDbForValidCredentials(
      {
        id: 'sa-1',
        serviceName: 'feed',
        clientId: 'feed-client',
        clientSecretHash: hashedSecret,
        createdAt: new Date(),
      },
      {
        id: TEST_KID,
        publicKey: JSON.stringify(publicKeyJwk),
        privateKey: JSON.stringify(privateKeyJwk),
        createdAt: new Date(),
        expiresAt: null,
      },
    )

    const route = createServiceTokenRoute(db, logger)

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
    expect(body.access_token).toBeDefined()

    // JWT を検証
    const pubKey = await importJWK(publicKeyJwk, 'RS256')
    const { payload } = await jwtVerify(body.access_token, pubKey)
    expect(payload.sub).toBe('sa-1')
    expect(payload.type).toBe('service')
    expect(payload.service_name).toBe('feed')
    expect(payload.client_id).toBe('feed-client')
    expect(payload.iss).toBe('bookmark-rss-auth')
  })

  it('should return 400 for missing fields', async () => {
    const db = createMockDbForInvalidClient()
    const route = createServiceTokenRoute(db, logger)

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
