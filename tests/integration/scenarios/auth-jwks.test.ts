import { describe, it, expect, beforeAll } from 'vitest'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { loadTestEnv, type TestEnv } from '../helpers/env'
import { generateUserJwt, generateServiceJwt } from '../helpers/jwt-helper'
import { fetchWithoutAuth } from '../helpers/http-client'
import { waitForService } from '../helpers/wait-for-service'

describe('auth-jwks: 認証基盤の結合テスト', () => {
  let env: TestEnv

  beforeAll(async () => {
    env = loadTestEnv()
    await waitForService(env.AUTH_BASE_URL, { serviceName: 'auth' })
  })

  describe('GET /auth/.well-known/jwks.json', () => {
    it('公開鍵を含む JWKS を返す', async () => {
      const res = await fetchWithoutAuth<{
        keys: Array<{
          kty: string
          kid: string
          alg: string
          n: string
          e: string
          use: string
        }>
      }>(`${env.AUTH_BASE_URL}/auth/.well-known/jwks.json`)

      expect(res.status).toBe(200)
      expect(res.data.keys).toBeDefined()
      expect(res.data.keys.length).toBeGreaterThanOrEqual(1)

      const key = res.data.keys[0]
      expect(key.kty).toBe('RSA')
      expect(key.alg).toBe('RS256')
      expect(key.use).toBe('sig')
      expect(key.kid).toBeDefined()
      expect(key.n).toBeDefined()
      expect(key.e).toBeDefined()
    })

    it('返された JWKS で JWT の署名検証が可能', async () => {
      const token = await generateUserJwt('test-user-1')
      const JWKS = createRemoteJWKSet(
        new URL(`${env.AUTH_BASE_URL}/auth/.well-known/jwks.json`),
      )

      const { payload } = await jwtVerify(token, JWKS, {
        issuer: 'bookmark-rss-auth',
      })

      expect(payload.sub).toBe('test-user-1')
      expect(payload.iss).toBe('bookmark-rss-auth')
      expect(payload.exp).toBeDefined()
    })
  })

  describe('POST /auth/service-token', () => {
    it('正しい credentials でサービス JWT を取得できる', async () => {
      const res = await fetchWithoutAuth<{
        access_token: string
        token_type: string
        expires_in: number
      }>(`${env.AUTH_BASE_URL}/auth/service-token`, {
        method: 'POST',
        body: {
          client_id: env.AI_CLIENT_ID,
          client_secret: env.AI_CLIENT_SECRET,
        },
      })

      expect(res.status).toBe(200)
      expect(res.data.access_token).toBeDefined()
      expect(typeof res.data.access_token).toBe('string')
      expect(res.data.token_type).toBe('Bearer')
      expect(res.data.expires_in).toBeGreaterThan(0)

      // 取得したトークンが JWKS で検証可能
      const JWKS = createRemoteJWKSet(
        new URL(`${env.AUTH_BASE_URL}/auth/.well-known/jwks.json`),
      )
      const { payload } = await jwtVerify(res.data.access_token, JWKS, {
        issuer: 'bookmark-rss-auth',
      })
      expect(payload).toBeDefined()
    })

    it('generateServiceJwt ヘルパーで取得したトークンも検証可能', async () => {
      const token = await generateServiceJwt()

      const JWKS = createRemoteJWKSet(
        new URL(`${env.AUTH_BASE_URL}/auth/.well-known/jwks.json`),
      )
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: 'bookmark-rss-auth',
      })
      expect(payload).toBeDefined()
    })

    it('不正な client_id で 401 を返す', async () => {
      const res = await fetchWithoutAuth(
        `${env.AUTH_BASE_URL}/auth/service-token`,
        {
          method: 'POST',
          body: {
            client_id: 'invalid-client',
            client_secret: env.AI_CLIENT_SECRET,
          },
        },
      )

      expect([401, 403]).toContain(res.status)
    })

    it('不正な client_secret で 401 を返す', async () => {
      const res = await fetchWithoutAuth(
        `${env.AUTH_BASE_URL}/auth/service-token`,
        {
          method: 'POST',
          body: {
            client_id: env.AI_CLIENT_ID,
            client_secret: 'wrong-secret',
          },
        },
      )

      expect([401, 403]).toContain(res.status)
    })

    it('credentials なしで 400 または 401 を返す', async () => {
      const res = await fetchWithoutAuth(
        `${env.AUTH_BASE_URL}/auth/service-token`,
        {
          method: 'POST',
          body: {},
        },
      )

      expect([400, 401, 403]).toContain(res.status)
    })
  })
})
