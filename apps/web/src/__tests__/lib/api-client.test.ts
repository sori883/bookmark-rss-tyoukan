import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~/lib/auth', () => ({
  fetchJwt: vi.fn(),
}))

import { apiClient } from '~/lib/api-client'
import { fetchJwt } from '~/lib/auth'

const mockFetchJwt = vi.mocked(fetchJwt)

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockFetchJwt.mockResolvedValue('test-jwt-token')
  })

  describe('getFeeds', () => {
    it('should fetch feeds with authorization header', async () => {
      const mockFeeds = [
        { id: '1', user_id: 'u1', url: 'https://example.com/feed', title: 'Test', site_url: 'https://example.com', last_fetched_at: null, created_at: '2024-01-01' },
      ]
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockFeeds), { status: 200 }),
      )

      const result = await apiClient.getFeeds()

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/feeds',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-jwt-token',
          }),
        }),
      )
      expect(result).toEqual(mockFeeds)
    })
  })

  describe('createFeed', () => {
    it('should post feed with correct body', async () => {
      const mockFeed = { id: '1', url: 'https://example.com/feed', title: 'Test' }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(mockFeed), { status: 201 }),
      )

      await apiClient.createFeed({ url: 'https://example.com/feed' })

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/feeds',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ url: 'https://example.com/feed' }),
        }),
      )
    })
  })

  describe('deleteFeed', () => {
    it('should send DELETE request', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, { status: 204 }),
      )

      await apiClient.deleteFeed('feed-id')

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/feeds/feed-id',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })

  describe('JWT refresh on 401', () => {
    it('should retry with new token on 401 response', async () => {
      mockFetchJwt
        .mockResolvedValueOnce('old-token')
        .mockResolvedValueOnce('new-token')

      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      fetchSpy
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify([]), { status: 200 }),
        )

      await apiClient.getFeeds()

      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(mockFetchJwt).toHaveBeenCalledTimes(2)
      expect(mockFetchJwt).toHaveBeenLastCalledWith(true)
    })
  })

  describe('error handling', () => {
    it('should throw ApiError on error response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }),
          { status: 404 },
        ),
      )

      await expect(apiClient.getBookmark('nonexistent')).rejects.toThrow('Not found')
    })
  })
})
