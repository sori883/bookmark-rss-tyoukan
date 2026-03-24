import { eq } from 'drizzle-orm'
import { settings } from '@bookmark-rss/db'
import type { AppDb } from '../lib/db'
import type pino from 'pino'

const WEBHOOK_TIMEOUT_MS = 10_000

export interface WebhookResult {
  readonly sent: boolean
  readonly error?: string
}

interface SlackPayload {
  readonly text: string
}

interface DiscordPayload {
  readonly content: string
}

function buildPayload(webhookType: string, message: string): SlackPayload | DiscordPayload {
  switch (webhookType) {
    case 'discord':
      return { content: message }
    case 'slack':
      return { text: message }
    default:
      throw new Error(`Unsupported webhook type: ${webhookType}`)
  }
}

export function isAllowedWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') {
      return false
    }
    const hostname = parsed.hostname
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('192.168.') ||
      hostname === '169.254.169.254' ||
      hostname.endsWith('.local')
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}

export async function sendWebhook(
  db: AppDb,
  userId: string,
  message: string,
  logger: pino.Logger,
): Promise<WebhookResult> {
  const userSettings = await db
    .select({
      webhookUrl: settings.webhookUrl,
      webhookType: settings.webhookType,
    })
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1)

  const setting = userSettings[0]

  if (!setting?.webhookUrl || !setting.webhookType) {
    logger.info({ userId }, 'No webhook configured, skipping')
    return { sent: false }
  }

  if (!isAllowedWebhookUrl(setting.webhookUrl)) {
    logger.error({ userId, url: setting.webhookUrl }, 'Webhook URL not allowed')
    return { sent: false, error: 'Webhook URL not allowed' }
  }

  const payload = buildPayload(setting.webhookType, message)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)

  try {
    const response = await fetch(setting.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorMsg = `Webhook responded with ${response.status}`
      logger.error({ userId, status: response.status }, errorMsg)
      return { sent: false, error: errorMsg }
    }

    logger.info({ userId, webhookType: setting.webhookType }, 'Webhook sent')
    return { sent: true }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown webhook error'
    logger.error({ userId, err }, 'Webhook send failed')
    return { sent: false, error: errorMsg }
  } finally {
    clearTimeout(timeoutId)
  }
}
