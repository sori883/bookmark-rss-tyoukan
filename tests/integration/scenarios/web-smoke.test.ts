import { describe, it, expect, beforeAll } from 'vitest'

const WEB_BASE_URL = process.env.WEB_BASE_URL ?? 'http://localhost:5173'
const HEALTH_CHECK_TIMEOUT = 5_000
const REQUEST_TIMEOUT = 10_000

/**
 * Web サービスの起動状態を確認する。
 * fetch で接続を試み、成功すれば true を返す。
 */
async function isWebServiceRunning(): Promise<boolean> {
  try {
    const response = await fetch(WEB_BASE_URL, {
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT),
    })
    return response.ok
  } catch {
    return false
  }
}

describe('web-smoke: Web アプリ スモークテスト', () => {
  let webRunning = false

  beforeAll(async () => {
    webRunning = await isWebServiceRunning()
    if (!webRunning) {
      console.info(
        `[skip] Web service at ${WEB_BASE_URL} is not running. Skipping smoke tests.`,
      )
    }
  })

  describe('GET /', () => {
    it('ルートパスで HTML が返る', async ({ skip }) => {
      if (!webRunning) {
        skip()
        return
      }

      const response = await fetch(WEB_BASE_URL, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      })

      expect(response.status).toBe(200)

      const contentType = response.headers.get('content-type') ?? ''
      expect(contentType).toContain('text/html')

      const html = await response.text()
      expect(html).toBeTruthy()
      expect(html.length).toBeGreaterThan(0)
    })
  })

  describe('GET /login', () => {
    it('ログインページで HTML が返る', async ({ skip }) => {
      if (!webRunning) {
        skip()
        return
      }

      const response = await fetch(`${WEB_BASE_URL}/login`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      })

      expect(response.status).toBe(200)

      const contentType = response.headers.get('content-type') ?? ''
      expect(contentType).toContain('text/html')

      const html = await response.text()
      expect(html).toBeTruthy()
      expect(html.length).toBeGreaterThan(0)
    })
  })

  describe('レスポンスヘッダ確認', () => {
    it('Content-Type に text/html が含まれる', async ({ skip }) => {
      if (!webRunning) {
        skip()
        return
      }

      const response = await fetch(WEB_BASE_URL, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      })

      const contentType = response.headers.get('content-type') ?? ''
      expect(contentType).toContain('text/html')
    })
  })
})
