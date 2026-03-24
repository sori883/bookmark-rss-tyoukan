import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { verifyServiceAccount } from '../services/service-account'

// DB のモック型
function createMockDb(returnRows: unknown[]) {
  const mockLimit = vi.fn().mockReturnValue({
    then: (cb: (rows: unknown[]) => unknown) => Promise.resolve(cb(returnRows)),
  })
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit })
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })
  return { select: mockSelect } as unknown as Parameters<typeof verifyServiceAccount>[0]
}

describe('verifyServiceAccount', () => {
  const SALT_ROUNDS = 10
  let hashedSecret: string

  beforeEach(async () => {
    hashedSecret = await bcrypt.hash('test-secret', SALT_ROUNDS)
  })

  it('should return account info when credentials are valid', async () => {
    const mockAccount = {
      id: 'sa-1',
      serviceName: 'feed',
      clientId: 'feed-client',
      clientSecretHash: hashedSecret,
      createdAt: new Date(),
    }
    const db = createMockDb([mockAccount])

    const result = await verifyServiceAccount(db, 'feed-client', 'test-secret')

    expect(result).toEqual({
      id: 'sa-1',
      serviceName: 'feed',
      clientId: 'feed-client',
    })
  })

  it('should throw UnauthorizedError when client_id not found', async () => {
    const db = createMockDb([])

    await expect(
      verifyServiceAccount(db, 'unknown-client', 'test-secret'),
    ).rejects.toThrow('Invalid client credentials')
  })

  it('should throw UnauthorizedError when secret is wrong', async () => {
    const mockAccount = {
      id: 'sa-1',
      serviceName: 'feed',
      clientId: 'feed-client',
      clientSecretHash: hashedSecret,
      createdAt: new Date(),
    }
    const db = createMockDb([mockAccount])

    await expect(
      verifyServiceAccount(db, 'feed-client', 'wrong-secret'),
    ).rejects.toThrow('Invalid client credentials')
  })

  it('should not expose account details in error for invalid client_id', async () => {
    const db = createMockDb([])

    try {
      await verifyServiceAccount(db, 'bad-id', 'bad-secret')
      expect.fail('Should have thrown')
    } catch (err: unknown) {
      const error = err as { code: string; message: string }
      expect(error.code).toBe('UNAUTHORIZED')
      expect(error.message).not.toContain('bad-id')
    }
  })
})
