import { Hono } from 'hono'
import { jwks as jwksTable } from '@bookmark-rss/db'
import type { AppDb } from '../lib/db'

export function createJwksRoute(db: AppDb) {
  const app = new Hono()

  app.get('/.well-known/jwks.json', async (c) => {
    const rows = await db.select().from(jwksTable)

    const keys = rows.map((row) => {
      const publicKey = JSON.parse(row.publicKey) as Record<string, unknown>
      return {
        ...publicKey,
        kid: row.id,
        use: 'sig',
      }
    })

    return c.json({ keys })
  })

  return app
}
