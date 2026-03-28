import { describe, it, expect, beforeEach } from 'vitest'
import { fakeBrowser } from 'wxt/testing'
import { saveToken, getToken, getTokenData, removeToken, isTokenExpired } from '@/lib/storage'

describe('storage', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  describe('saveToken / getToken', () => {
    it('トークンを保存・取得できる', async () => {
      await saveToken('test-jwt-token', 3600)
      const token = await getToken()
      expect(token).toBe('test-jwt-token')
    })
  })

  describe('getTokenData', () => {
    it('トークンと有効期限をまとめて取得できる', async () => {
      await saveToken('test-jwt-token', 3600)
      const data = await getTokenData()
      expect(data).not.toBeNull()
      expect(data!.token).toBe('test-jwt-token')
      expect(data!.expiryTime).toBeGreaterThan(Date.now())
    })

    it('未保存の場合 null を返す', async () => {
      const data = await getTokenData()
      expect(data).toBeNull()
    })
  })

  describe('getToken', () => {
    it('未保存の場合 null を返す', async () => {
      const token = await getToken()
      expect(token).toBeNull()
    })
  })

  describe('removeToken', () => {
    it('トークンを削除できる', async () => {
      await saveToken('test-jwt-token', 3600)
      await removeToken()
      const token = await getToken()
      expect(token).toBeNull()
    })
  })

  describe('isTokenExpired', () => {
    it('トークンが未保存の場合 true を返す', async () => {
      const expired = await isTokenExpired()
      expect(expired).toBe(true)
    })

    it('有効期限内のトークンは false を返す', async () => {
      await saveToken('test-jwt-token', 3600)
      const expired = await isTokenExpired()
      expect(expired).toBe(false)
    })

    it('有効期限切れのトークンは true を返す', async () => {
      await saveToken('test-jwt-token', -1)
      const expired = await isTokenExpired()
      expect(expired).toBe(true)
    })
  })
})
