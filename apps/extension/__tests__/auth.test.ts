import { describe, it, expect, vi, afterEach } from 'vitest'
import { trySessionAuth } from '@/lib/auth'

const MOCK_AUTH_BASE_URL = 'http://localhost:3000'

vi.mock('@/lib/config', () => ({
  getAuthBaseUrl: () => MOCK_AUTH_BASE_URL,
}))

describe('auth', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('trySessionAuth', () => {
    it('セッションがない場合 false を返す', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('', { status: 401 }),
      )

      const result = await trySessionAuth()
      expect(result).toBe(false)
    })

    it('JWT を取得できた場合 true を返す', async () => {
      const headers = new Headers()
      headers.set('set-auth-jwt', 'jwt-token-123')

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('{}', { status: 200, headers }),
      )

      const result = await trySessionAuth()
      expect(result).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        `${MOCK_AUTH_BASE_URL}/auth/get-session`,
        { credentials: 'include' },
      )
    })

    it('JWT ヘッダーがない場合 false を返す', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('{}', { status: 200 }),
      )

      const result = await trySessionAuth()
      expect(result).toBe(false)
    })

    it('fetch エラーの場合 false を返す', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network error'))

      const result = await trySessionAuth()
      expect(result).toBe(false)
    })
  })
})
