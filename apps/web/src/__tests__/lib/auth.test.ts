import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSession, fetchJwt, signOut, clearJwtCache } from '~/lib/auth'

describe('auth', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearJwtCache()
  })

  describe('getSession', () => {
    it('should return user on valid session', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session: { id: 's1', userId: 'u1', token: 'tok', expiresAt: '2099-01-01' },
            user: { id: 'u1', email: 'test@example.com', name: 'Test User', image: null },
          }),
          { status: 200 },
        ),
      )

      const result = await getSession()

      expect(result).toEqual({
        user: { id: 'u1', email: 'test@example.com', name: 'Test User' },
      })
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/get-session'),
        expect.objectContaining({ credentials: 'include' }),
      )
    })

    it('should return null on 401', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, { status: 401 }),
      )

      const result = await getSession()
      expect(result).toBeNull()
    })

    it('should return null on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

      const result = await getSession()
      expect(result).toBeNull()
    })
  })

  describe('fetchJwt', () => {
    it('should fetch and cache JWT', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'set-auth-jwt': 'jwt-token-123' },
        }),
      )

      const token = await fetchJwt()
      expect(token).toBe('jwt-token-123')

      const cachedToken = await fetchJwt()
      expect(cachedToken).toBe('jwt-token-123')
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })

    it('should force refresh when requested', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'set-auth-jwt': 'old-token' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'set-auth-jwt': 'new-token' },
          }),
        )

      await fetchJwt()
      const newToken = await fetchJwt(true)

      expect(newToken).toBe('new-token')
      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    })

    it('should throw on failed fetch', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, { status: 401 }),
      )

      await expect(fetchJwt()).rejects.toThrow('Failed to fetch JWT')
    })

    it('should throw when set-auth-jwt header is missing', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 }),
      )

      await expect(fetchJwt()).rejects.toThrow('Failed to fetch JWT')
    })
  })

  describe('signOut', () => {
    it('should clear cache and call sign-out endpoint', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'set-auth-jwt': 'jwt' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(null, { status: 200 }),
        )

      await fetchJwt()
      await signOut()

      expect(fetchSpy).toHaveBeenLastCalledWith(
        expect.stringContaining('/auth/sign-out'),
        expect.objectContaining({ method: 'POST', credentials: 'include' }),
      )
    })
  })
})
