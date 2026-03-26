import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { SignJWT, importJWK } from 'jose'
import { eq, and, gt } from 'drizzle-orm'
import { deviceCodes, jwks as jwksTable, users } from '@bookmark-rss/db'
import type { AppDb } from '../lib/db'
import type { AuthInstance } from '../auth'

const DEVICE_CODE_EXPIRY_MINUTES = 10
const USER_CODE_LENGTH = 8

function generateCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

function formatUserCode(code: string): string {
  const mid = Math.floor(code.length / 2)
  return `${code.slice(0, mid)}-${code.slice(mid)}`
}

export function createDeviceRoute(db: AppDb, auth: AuthInstance) {
  const app = new Hono()

  // POST /auth/device/code — デバイスコード発行
  app.post('/device/code', async (c) => {
    const deviceCode = crypto.randomUUID()
    const userCode = generateCode(USER_CODE_LENGTH)
    const expiresAt = new Date(
      Date.now() + DEVICE_CODE_EXPIRY_MINUTES * 60 * 1000,
    )

    await db.insert(deviceCodes).values({
      deviceCode,
      userCode,
      expiresAt,
    })

    const baseUrl = new URL(c.req.url).origin

    return c.json({
      device_code: deviceCode,
      user_code: formatUserCode(userCode),
      verification_uri: `${baseUrl}/auth/device`,
      expires_in: DEVICE_CODE_EXPIRY_MINUTES * 60,
      interval: 5,
    })
  })

  // POST /auth/device/token — CLIがポーリングするエンドポイント
  app.post(
    '/device/token',
    zValidator(
      'json',
      z.object({
        device_code: z.string(),
      }),
    ),
    async (c) => {
      const { device_code } = c.req.valid('json')

      const [record] = await db
        .select()
        .from(deviceCodes)
        .where(
          and(
            eq(deviceCodes.deviceCode, device_code),
            gt(deviceCodes.expiresAt, new Date()),
          ),
        )
        .limit(1)

      if (!record) {
        return c.json({ error: 'expired_token' }, 400)
      }

      if (record.status === 'pending') {
        return c.json({ error: 'authorization_pending' }, 428)
      }

      if (record.status === 'authorized' && record.userId) {
        // 認証済み: ユーザーJWTを発行
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, record.userId))
          .limit(1)

        if (!user) {
          return c.json({ error: 'user_not_found' }, 400)
        }

        const privateKeyRow = await db
          .select()
          .from(jwksTable)
          .orderBy(jwksTable.createdAt)
          .limit(1)
          .then((rows) => rows[0])

        if (!privateKeyRow) {
          return c.json({ error: 'signing_key_unavailable' }, 500)
        }

        const publicKeyJwk = JSON.parse(privateKeyRow.publicKey) as { alg?: string }
        const alg = publicKeyJwk.alg ?? 'EdDSA'
        const privateKeyJwk = JSON.parse(privateKeyRow.privateKey) as JsonWebKey
        const privateKey = await importJWK(privateKeyJwk, alg)

        const expirySeconds = 30 * 24 * 60 * 60 // 30日
        const token = await new SignJWT({
          email: user.email,
          name: user.name,
        })
          .setProtectedHeader({ alg, kid: privateKeyRow.id })
          .setIssuer('bookmark-rss-auth')
          .setSubject(user.id)
          .setIssuedAt()
          .setExpirationTime(`${expirySeconds}s`)
          .sign(privateKey)

        // デバイスコードを削除（使い捨て）
        await db
          .delete(deviceCodes)
          .where(eq(deviceCodes.deviceCode, device_code))

        return c.json({
          access_token: token,
          token_type: 'Bearer',
          expires_in: expirySeconds,
        })
      }

      return c.json({ error: 'expired_token' }, 400)
    },
  )

  // GET /auth/device — ブラウザ用コード入力ページ
  app.get('/device', (c) => {
    return c.html(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CLI ログイン - bookmark-rss</title>
<style>
  body { font-family: system-ui; max-width: 400px; margin: 80px auto; padding: 0 20px; background: #0a0a0a; color: #e5e5e5; }
  h1 { font-size: 1.5rem; text-align: center; }
  p { text-align: center; color: #a3a3a3; }
  form { margin-top: 2rem; }
  input { width: 100%; padding: 12px; font-size: 1.5rem; text-align: center; letter-spacing: 4px; text-transform: uppercase;
    background: #1a1a1a; border: 1px solid #333; border-radius: 8px; color: #e5e5e5; box-sizing: border-box; }
  button { width: 100%; padding: 12px; margin-top: 12px; font-size: 1rem; font-weight: 600;
    background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; }
  button:hover { background: #2563eb; }
  .error { color: #ef4444; text-align: center; margin-top: 8px; }
  .success { color: #22c55e; text-align: center; margin-top: 8px; }
</style>
</head><body>
<h1>CLI ログイン</h1>
<p>CLIに表示されたコードを入力してください</p>
<form id="form">
  <input type="text" id="code" placeholder="XXXX-XXXX" maxlength="9" autocomplete="off" autofocus>
  <div id="msg"></div>
  <button type="submit">認証する</button>
</form>
<script>
document.getElementById('form').onsubmit = async (e) => {
  e.preventDefault();
  const code = document.getElementById('code').value.replace(/-/g, '').toUpperCase();
  const msg = document.getElementById('msg');
  try {
    const res = await fetch('/auth/device/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_code: code }),
      credentials: 'include',
    });
    const data = await res.json();
    if (res.ok) {
      msg.className = 'success';
      msg.textContent = 'CLIの認証が完了しました。このページを閉じてください。';
      document.querySelector('button').disabled = true;
    } else {
      msg.className = 'error';
      msg.textContent = data.error === 'invalid_code' ? 'コードが無効です' : data.error;
    }
  } catch { msg.className = 'error'; msg.textContent = '通信エラー'; }
};
</script>
</body></html>`)
  })

  // POST /auth/device/authorize — ブラウザからコード認証
  app.post(
    '/device/authorize',
    zValidator(
      'json',
      z.object({
        user_code: z.string().min(1),
      }),
    ),
    async (c) => {
      const { user_code } = c.req.valid('json')
      const normalizedCode = user_code.replace(/-/g, '').toUpperCase()

      // Better Auth セッションからユーザーIDを取得
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      })

      if (!session?.user?.id) {
        // 未ログイン: Google OAuth にリダイレクトさせる
        return c.json({ error: 'not_authenticated', login_url: '/auth/sign-in/social' }, 401)
      }

      const [record] = await db
        .select()
        .from(deviceCodes)
        .where(
          and(
            eq(deviceCodes.userCode, normalizedCode),
            eq(deviceCodes.status, 'pending'),
            gt(deviceCodes.expiresAt, new Date()),
          ),
        )
        .limit(1)

      if (!record) {
        return c.json({ error: 'invalid_code' }, 400)
      }

      // デバイスコードを認証済みに更新
      await db
        .update(deviceCodes)
        .set({ status: 'authorized', userId: session.user.id })
        .where(eq(deviceCodes.id, record.id))

      return c.json({ status: 'authorized' })
    },
  )

  return app
}
