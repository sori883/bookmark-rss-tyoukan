import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface TestEnv {
  readonly DATABASE_URL: string
  readonly AUTH_BASE_URL: string
  readonly FEED_BASE_URL: string
  readonly AI_BASE_URL: string
  readonly NOTIFICATION_BASE_URL: string
  readonly AI_CLIENT_ID: string
  readonly AI_CLIENT_SECRET: string
  readonly TEST_WEBHOOK_URL: string | undefined
  readonly TEST_WEBHOOK_TYPE: string
}

let cachedEnv: TestEnv | undefined

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

/**
 * Load .env.test from project root and return typed environment variables.
 * Results are cached after the first call.
 */
export function loadTestEnv(): TestEnv {
  if (cachedEnv) {
    return cachedEnv
  }

  // Load .env.test from project root (tests/integration/helpers/../../.env.test)
  config({
    path: resolve(__dirname, '..', '..', '..', '.env.test'),
  })

  const env: TestEnv = {
    DATABASE_URL: requireEnv('DATABASE_URL'),
    AUTH_BASE_URL: process.env.AUTH_SERVICE_URL ?? 'http://localhost:3000',
    FEED_BASE_URL: process.env.FEED_SERVICE_URL ?? 'http://localhost:3001',
    AI_BASE_URL: process.env.AI_SERVICE_URL ?? 'http://localhost:3003',
    NOTIFICATION_BASE_URL: process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:3004',
    AI_CLIENT_ID: requireEnv('AI_CLIENT_ID'),
    AI_CLIENT_SECRET: requireEnv('AI_CLIENT_SECRET'),
    TEST_WEBHOOK_URL: process.env.TEST_WEBHOOK_URL,
    TEST_WEBHOOK_TYPE: process.env.TEST_WEBHOOK_TYPE ?? 'discord',
  }

  cachedEnv = env
  return env
}

/**
 * Reset cached environment (for testing the helper itself).
 */
export function resetTestEnv(): void {
  cachedEnv = undefined
}
