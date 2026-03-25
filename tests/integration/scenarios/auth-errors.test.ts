import { describe, it, expect, beforeAll } from 'vitest'
import { SignJWT, generateKeyPair } from 'jose'
import { loadTestEnv, type TestEnv } from '../helpers/env'
import { generateCustomJwt } from '../helpers/jwt-helper'
import { createAuthClient, fetchWithoutAuth } from '../helpers/http-client'
import { waitForServices } from '../helpers/wait-for-service'

describe('auth-errors: 認証エラーの結合テスト', () => {
  let env: TestEnv

  beforeAll(async () => {
    env = loadTestEnv()
    await waitForServices([
      { baseUrl: env.FEED_BASE_URL, name: 'feed' },
      { baseUrl: env.NOTIFICATION_BASE_URL, name: 'notification' },
    ])
  })

  describe('期限切れ JWT', () => {
    it('feed サービスへのリクエストが 401 を返す', async () => {
      // 1秒前に期限切れになるトークンを生成
      const expiredToken = await generateCustomJwt(
        { sub: 'test-user-1' },
        '-1s',
      )
      const client = createAuthClient(env.FEED_BASE_URL, expiredToken)

      const res = await client.get('/feeds')
      expect(res.status).toBe(401)
    })

    it('notification サービスへのリクエストが 401 を返す', async () => {
      const expiredToken = await generateCustomJwt(
        { sub: 'test-user-1' },
        '-1s',
      )
      const client = createAuthClient(env.NOTIFICATION_BASE_URL, expiredToken)

      const res = await client.get('/notifications')
      expect(res.status).toBe(401)
    })
  })

  describe('無効な署名の JWT', () => {
    it('異なる RSA 鍵で署名されたトークンで 401 を返す', async () => {
      const { privateKey: fakeKey } = await generateKeyPair('RS256')
      const fakeToken = await new SignJWT({ sub: 'test-user-1' })
        .setProtectedHeader({ alg: 'RS256', kid: 'fake-key-id' })
        .setIssuer('bookmark-rss-auth')
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(fakeKey)

      const client = createAuthClient(env.FEED_BASE_URL, fakeToken)
      const res = await client.get('/feeds')

      expect(res.status).toBe(401)
    })
  })

  describe('Bearer トークンなし', () => {
    it('feed: GET /feeds に認証ヘッダなしで 401', async () => {
      const res = await fetchWithoutAuth(`${env.FEED_BASE_URL}/feeds`)
      expect(res.status).toBe(401)
    })

    it('feed: POST /feeds に認証ヘッダなしで 401', async () => {
      const res = await fetchWithoutAuth(`${env.FEED_BASE_URL}/feeds`, {
        method: 'POST',
        body: { url: 'https://github.blog/feed/' },
      })
      expect(res.status).toBe(401)
    })

    it('feed: GET /articles に認証ヘッダなしで 401', async () => {
      const res = await fetchWithoutAuth(`${env.FEED_BASE_URL}/articles`)
      expect(res.status).toBe(401)
    })

    it('feed: GET /settings に認証ヘッダなしで 401', async () => {
      const res = await fetchWithoutAuth(`${env.FEED_BASE_URL}/settings`)
      expect(res.status).toBe(401)
    })

    it('notification: GET /notifications に認証ヘッダなしで 401', async () => {
      const res = await fetchWithoutAuth(
        `${env.NOTIFICATION_BASE_URL}/notifications`,
      )
      expect(res.status).toBe(401)
    })
  })

  describe('不正な形式の Authorization ヘッダ', () => {
    it('Bearer プレフィックスなしで 401 を返す', async () => {
      const res = await fetchWithoutAuth(`${env.FEED_BASE_URL}/feeds`, {
        headers: { Authorization: 'invalid-token-without-bearer' },
      })
      expect(res.status).toBe(401)
    })

    it('空の Bearer トークンで 401 を返す', async () => {
      const res = await fetchWithoutAuth(`${env.FEED_BASE_URL}/feeds`, {
        headers: { Authorization: 'Bearer ' },
      })
      expect(res.status).toBe(401)
    })

    it('ランダム文字列の Bearer トークンで 401 を返す', async () => {
      const res = await fetchWithoutAuth(`${env.FEED_BASE_URL}/feeds`, {
        headers: {
          Authorization: 'Bearer not-a-valid-jwt-at-all',
        },
      })
      expect(res.status).toBe(401)
    })
  })
})
