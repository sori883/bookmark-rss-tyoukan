import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createNotification,
  listNotifications,
  markAsRead,
} from '../services/notification-service'
import { NotFoundError } from '../lib/errors'
import type pino from 'pino'

vi.mock('../services/webhook-sender', () => ({
  sendWebhook: vi.fn().mockResolvedValue({ sent: true }),
}))

import { sendWebhook } from '../services/webhook-sender'

function createMockLogger(): pino.Logger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  } as unknown as pino.Logger
}

describe('createNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should insert notification and call sendWebhook', async () => {
    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'notif-1' }]),
        }),
      }),
    } as unknown as Parameters<typeof createNotification>[0]

    const logger = createMockLogger()

    const result = await createNotification(
      mockDb,
      { userId: 'user-1', message: 'Test notification' },
      logger,
    )

    expect(result.id).toBe('notif-1')
    expect(result.webhookSent).toBe(true)
    expect(sendWebhook).toHaveBeenCalledWith(mockDb, 'user-1', 'Test notification', logger)
  })
})

describe('listNotifications', () => {
  it('should return paginated notifications', async () => {
    const rows = [
      { id: 'n1', userId: 'user-1', type: 'webhook', message: 'msg1', isRead: false, sentAt: new Date() },
      { id: 'n2', userId: 'user-1', type: 'webhook', message: 'msg2', isRead: true, sentAt: new Date() },
    ]

    const mockDb = {
      select: vi.fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 5 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue(rows),
                }),
              }),
            }),
          }),
        }),
    } as unknown as Parameters<typeof listNotifications>[0]

    const result = await listNotifications(mockDb, {
      userId: 'user-1',
      page: 1,
      limit: 20,
    })

    expect(result.total).toBe(5)
    expect(result.data).toHaveLength(2)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
  })
})

describe('markAsRead', () => {
  it('should update and return notification', async () => {
    const updated = {
      id: 'n1',
      userId: 'user-1',
      type: 'webhook',
      message: 'msg',
      isRead: true,
      sentAt: new Date(),
    }

    const mockDb = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      }),
    } as unknown as Parameters<typeof markAsRead>[0]

    const result = await markAsRead(mockDb, 'n1', 'user-1', true)

    expect(result.isRead).toBe(true)
    expect(result.id).toBe('n1')
  })

  it('should throw NotFoundError when notification does not exist', async () => {
    const mockDb = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as unknown as Parameters<typeof markAsRead>[0]

    await expect(markAsRead(mockDb, 'nonexistent', 'user-1', true)).rejects.toThrow(NotFoundError)
  })
})
