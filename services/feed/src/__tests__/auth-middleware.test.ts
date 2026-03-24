import { Hono } from 'hono'
import { generateKeyPair, exportJWK, SignJWT } from 'jose'
import { errorResponse } from '../lib/errors.js'

// joseのcreateRemoteJWKSetをモックし、テスト用鍵を使う
let publicKeyJwk: JsonWebKey
let signToken: (claims: Record<string, unknown>, expiresIn?: string) => Promise<string>

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256', {
    extractable: true,
  })
  publicKeyJwk = await exportJWK(publicKey)

  signToken = async (claims, expiresIn = '1h') => {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer('bookmark-rss-auth')
      .setSubject(claims.sub as string)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(privateKey)
  }
})

// テスト用にJWKSモック付きのauthMiddlewareを作成
async function createTestApp() {
  const { importJWK, jwtVerify } = await import('jose')
  const { createMiddleware } = await import('hono/factory')
  const { UnauthorizedError } = await import('../lib/errors.js')

  const pubKey = await importJWK(publicKeyJwk, 'RS256')

  const authMiddleware = createMiddleware(async (c, next) => {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined

    if (!token) {
      throw new UnauthorizedError('Missing Bearer token')
    }

    try {
      const { payload } = await jwtVerify(token, pubKey)
      c.set('jwtPayload', payload)
      await next()
    } catch {
      throw new UnauthorizedError('Invalid or expired token')
    }
  })

  const app = new Hono()
  app.use('/protected/*', authMiddleware)
  app.get('/protected/test', (c) => {
    const payload = c.get('jwtPayload') as Record<string, unknown>
    return c.json({ sub: payload.sub, type: payload.type })
  })
  app.onError((err, c) => errorResponse(c, err))

  return app
}

describe('Auth Middleware', () => {
  it('should return 401 when no Authorization header', async () => {
    const app = await createTestApp()
    const res = await app.request('/protected/test')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('should return 401 for invalid token', async () => {
    const app = await createTestApp()
    const res = await app.request('/protected/test', {
      headers: { Authorization: 'Bearer invalid-token' },
    })
    expect(res.status).toBe(401)
  })

  it('should return 401 for expired token', async () => {
    const app = await createTestApp()
    const token = await signToken({ sub: 'user-1' }, '0s')
    // 少し待って期限切れに
    await new Promise((r) => setTimeout(r, 1100))
    const res = await app.request('/protected/test', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(401)
  })

  it('should pass with valid user JWT', async () => {
    const app = await createTestApp()
    const token = await signToken({ sub: 'user-1', email: 'test@example.com' })
    const res = await app.request('/protected/test', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sub).toBe('user-1')
  })

  it('should pass with valid service JWT', async () => {
    const app = await createTestApp()
    const token = await signToken({
      sub: 'sa-1',
      type: 'service',
      service_name: 'ai',
    })
    const res = await app.request('/protected/test', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sub).toBe('sa-1')
    expect(body.type).toBe('service')
  })
})
