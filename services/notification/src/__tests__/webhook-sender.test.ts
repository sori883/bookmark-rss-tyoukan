import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendWebhook, isAllowedWebhookUrl } from '../services/webhook-sender'
import type pino from 'pino'

function createMockLogger(): pino.Logger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  } as unknown as pino.Logger
}

function createMockDb(settings: { webhookUrl: string | null; webhookType: string | null } | null) {
  const rows = settings ? [settings] : []
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  } as unknown as Parameters<typeof sendWebhook>[0]
}

describe('isAllowedWebhookUrl', () => {
  it('should allow valid HTTPS URLs', () => {
    expect(isAllowedWebhookUrl('https://hooks.slack.com/services/xxx')).toBe(true)
    expect(isAllowedWebhookUrl('https://discord.com/api/webhooks/xxx')).toBe(true)
  })

  it('should reject HTTP URLs', () => {
    expect(isAllowedWebhookUrl('http://hooks.slack.com/services/xxx')).toBe(false)
  })

  it('should reject localhost', () => {
    expect(isAllowedWebhookUrl('https://localhost:5432')).toBe(false)
    expect(isAllowedWebhookUrl('https://127.0.0.1')).toBe(false)
  })

  it('should reject private network addresses', () => {
    expect(isAllowedWebhookUrl('https://10.0.0.1/path')).toBe(false)
    expect(isAllowedWebhookUrl('https://192.168.1.1/path')).toBe(false)
    expect(isAllowedWebhookUrl('https://172.16.0.1/path')).toBe(false)
  })

  it('should reject AWS metadata endpoint', () => {
    expect(isAllowedWebhookUrl('https://169.254.169.254/latest/meta-data/')).toBe(false)
  })

  it('should reject .local domains', () => {
    expect(isAllowedWebhookUrl('https://myserver.local/webhook')).toBe(false)
  })

  it('should reject invalid URLs', () => {
    expect(isAllowedWebhookUrl('not-a-url')).toBe(false)
  })
})

describe('sendWebhook', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should send Slack webhook with correct payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)

    const db = createMockDb({ webhookUrl: 'https://hooks.slack.com/test', webhookType: 'slack' })
    const logger = createMockLogger()

    const result = await sendWebhook(db, 'user-1', 'Hello Slack', logger)

    expect(result.sent).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Hello Slack' }),
      }),
    )
  })

  it('should send Discord webhook with correct payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)

    const db = createMockDb({ webhookUrl: 'https://discord.com/api/webhooks/test', webhookType: 'discord' })
    const logger = createMockLogger()

    const result = await sendWebhook(db, 'user-1', 'Hello Discord', logger)

    expect(result.sent).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Hello Discord' }),
      }),
    )
  })

  it('should return sent: false when no webhook configured', async () => {
    const db = createMockDb(null)
    const logger = createMockLogger()

    const result = await sendWebhook(db, 'user-1', 'test', logger)

    expect(result.sent).toBe(false)
  })

  it('should return sent: false when webhook_url is null', async () => {
    const db = createMockDb({ webhookUrl: null, webhookType: 'slack' })
    const logger = createMockLogger()

    const result = await sendWebhook(db, 'user-1', 'test', logger)

    expect(result.sent).toBe(false)
  })

  it('should return sent: false when URL is not allowed (SSRF protection)', async () => {
    const db = createMockDb({ webhookUrl: 'http://localhost:5432', webhookType: 'slack' })
    const logger = createMockLogger()

    const result = await sendWebhook(db, 'user-1', 'test', logger)

    expect(result.sent).toBe(false)
    expect(result.error).toBe('Webhook URL not allowed')
  })

  it('should return sent: false when fetch fails', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', mockFetch)

    const db = createMockDb({ webhookUrl: 'https://hooks.slack.com/test', webhookType: 'slack' })
    const logger = createMockLogger()

    const result = await sendWebhook(db, 'user-1', 'test', logger)

    expect(result.sent).toBe(false)
    expect(result.error).toBe('Network error')
  })

  it('should return sent: false when webhook responds with error status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    vi.stubGlobal('fetch', mockFetch)

    const db = createMockDb({ webhookUrl: 'https://hooks.slack.com/test', webhookType: 'slack' })
    const logger = createMockLogger()

    const result = await sendWebhook(db, 'user-1', 'test', logger)

    expect(result.sent).toBe(false)
    expect(result.error).toBe('Webhook responded with 500')
  })
})
