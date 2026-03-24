import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { createJwksRoute } from '../routes/jwks'

function createMockDb(rows: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockResolvedValue(rows),
    }),
  } as unknown as Parameters<typeof createJwksRoute>[0]
}

describe('GET /auth/.well-known/jwks.json', () => {
  it('should return JWKS with keys', async () => {
    const mockPublicKey = {
      kty: 'RSA',
      alg: 'RS256',
      n: 'test-modulus',
      e: 'AQAB',
    }

    const db = createMockDb([
      {
        id: 'key-1',
        publicKey: JSON.stringify(mockPublicKey),
        privateKey: '{}',
        createdAt: new Date(),
        expiresAt: null,
      },
    ])

    const route = createJwksRoute(db)
    const app = new Hono()
    app.route('/auth', route)

    const res = await app.request('/auth/.well-known/jwks.json')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.keys).toHaveLength(1)
    expect(body.keys[0].kty).toBe('RSA')
    expect(body.keys[0].kid).toBe('key-1')
    expect(body.keys[0].use).toBe('sig')
    expect(body.keys[0].n).toBe('test-modulus')
  })

  it('should return empty keys when no JWKS rows', async () => {
    const db = createMockDb([])
    const route = createJwksRoute(db)
    const app = new Hono()
    app.route('/auth', route)

    const res = await app.request('/auth/.well-known/jwks.json')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.keys).toHaveLength(0)
  })

  it('should include multiple keys', async () => {
    const db = createMockDb([
      {
        id: 'key-1',
        publicKey: JSON.stringify({ kty: 'RSA', alg: 'RS256', n: 'mod1', e: 'AQAB' }),
        privateKey: '{}',
        createdAt: new Date(),
        expiresAt: null,
      },
      {
        id: 'key-2',
        publicKey: JSON.stringify({ kty: 'RSA', alg: 'RS256', n: 'mod2', e: 'AQAB' }),
        privateKey: '{}',
        createdAt: new Date(),
        expiresAt: null,
      },
    ])

    const route = createJwksRoute(db)
    const app = new Hono()
    app.route('/auth', route)

    const res = await app.request('/auth/.well-known/jwks.json')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.keys).toHaveLength(2)
    expect(body.keys[0].kid).toBe('key-1')
    expect(body.keys[1].kid).toBe('key-2')
  })
})
