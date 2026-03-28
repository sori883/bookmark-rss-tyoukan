import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fakeBrowser } from 'wxt/testing'
import { createBookmark, AuthError } from '@/lib/api-client'
import { saveToken } from '@/lib/storage'

const MOCK_API_BASE_URL = 'http://localhost:3001'

vi.mock('@/lib/config', () => ({
  getApiBaseUrl: () => MOCK_API_BASE_URL,
}))

describe('api-client', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createBookmark', () => {
    it('ブックマーク登録に成功する', async () => {
      await saveToken('valid-jwt-token', 3600)

      const mockBookmark = {
        id: 'bm-1',
        user_id: 'user-1',
        article_id: null,
        url: 'https://example.com',
        title: 'Example',
        content_markdown: '# Example',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockBookmark), { status: 201 }),
      )

      const result = await createBookmark('https://example.com')

      expect(result).toEqual(mockBookmark)
      expect(fetch).toHaveBeenCalledWith(
        `${MOCK_API_BASE_URL}/bookmarks`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ url: 'https://example.com' }),
        }),
      )
    })

    it('未認証の場合 AuthError をスローする', async () => {
      await expect(createBookmark('https://example.com')).rejects.toThrow(AuthError)
    })

    it('401 レスポ���スで AuthError をスローする', async () => {
      await saveToken('expired-token', 3600)

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('', { status: 401 }),
      )

      await expect(createBookmark('https://example.com')).rejects.toThrow(AuthError)
    })

    it('その他のエラーで Error をスローする', async () => {
      await saveToken('valid-jwt-token', 3600)

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'バリデーションエラー' } }), { status: 400 }),
      )

      await expect(createBookmark('https://example.com/invalid')).rejects.toThrow('バリデーションエラー')
    })

    it('無効な URL で Error をスローする', async () => {
      await saveToken('valid-jwt-token', 3600)
      await expect(createBookmark('not-a-url')).rejects.toThrow('無効なURLです')
    })

    it('http/https 以外のプロトコルで Error をスローする', async () => {
      await saveToken('valid-jwt-token', 3600)
      await expect(createBookmark('ftp://example.com')).rejects.toThrow('http または https のURLのみ登録できます')
    })
  })
})
