import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHmac, randomBytes } from 'node:crypto'
import { config } from 'dotenv'
import postgres from 'postgres'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({ path: resolve(__dirname, '..', '..', '..', '.env.test') })

const SESSION_ID = 'e2e-session-' + randomBytes(8).toString('hex')
const SESSION_TOKEN = randomBytes(24).toString('base64url')
const USER_ID = 'test-user-1'
const COOKIE_NAME = 'better-auth.session_token'

/**
 * Sign a cookie value using HMAC-SHA256 (same as Hono's setSignedCookie)
 * Format: {value}.{base64(HMAC-SHA256(value, secret))}
 */
function signCookie(value: string, secret: string): string {
  const signature = createHmac('sha256', secret).update(value).digest('base64')
  return `${value}.${signature}`
}

async function globalSetup() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required in .env.test')
  }

  const betterAuthSecret = process.env.BETTER_AUTH_SECRET
  if (!betterAuthSecret) {
    throw new Error('BETTER_AUTH_SECRET is required in .env.test')
  }

  const sql = postgres(databaseUrl)

  try {
    // Clean up old e2e sessions
    await sql`DELETE FROM sessions WHERE id LIKE 'e2e-session-%'`

    // Insert a fresh session for test-user-1
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await sql`
      INSERT INTO sessions (id, token, user_id, expires_at, created_at, updated_at)
      VALUES (${SESSION_ID}, ${SESSION_TOKEN}, ${USER_ID}, ${expiresAt}, NOW(), NOW())
    `

    // Ensure test bookmark exists for delete test
    const bookmarkId = 'e2e-bookmark-1'
    const existingBookmark = await sql`SELECT id FROM bookmarks WHERE id = ${bookmarkId}`
    if (existingBookmark.length === 0) {
      await sql`
        INSERT INTO bookmarks (id, user_id, url, title, content_markdown, created_at, updated_at)
        VALUES (${bookmarkId}, ${USER_ID}, 'https://e2e-test.example.com', 'E2E Test Bookmark', '# E2E Test', NOW(), NOW())
      `
    }

    // Ensure test notification exists for mark-read test
    const notificationId = 'e2e-notification-1'
    const existingNotification = await sql`SELECT id FROM notifications WHERE id = ${notificationId}`
    if (existingNotification.length === 0) {
      await sql`
        INSERT INTO notifications (id, user_id, type, message, is_read, sent_at)
        VALUES (${notificationId}, ${USER_ID}, 'webhook', 'E2E Test Notification', false, NOW())
      `
    }

    // Sign the cookie value with BETTER_AUTH_SECRET
    const signedToken = signCookie(SESSION_TOKEN, betterAuthSecret)

    // Write storageState with the signed session cookie
    const storageState = {
      cookies: [
        {
          name: COOKIE_NAME,
          value: signedToken,
          domain: 'localhost',
          path: '/',
          expires: Math.floor(Date.now() / 1000) + 86400,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax' as const,
        },
      ],
      origins: [],
    }

    const authDir = resolve(__dirname, '.auth')
    mkdirSync(authDir, { recursive: true })
    writeFileSync(
      resolve(authDir, 'storage-state.json'),
      JSON.stringify(storageState, null, 2),
    )
  } finally {
    await sql.end()
  }
}

export default globalSetup
