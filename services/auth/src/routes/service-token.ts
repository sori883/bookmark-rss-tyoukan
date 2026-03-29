import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { verifyServiceAccount } from '../services/service-account'
import type { AuthInstance } from '../auth'
import type { AppDb } from '../lib/db'
import type pino from 'pino'

const SERVICE_TOKEN_EXPIRY_SECONDS = 86400 // 24h
const ISSUER = 'bookmark-rss-auth'

const serviceTokenRequestSchema = z.object({
  client_id: z.string().min(1).max(128),
  client_secret: z.string().min(1).max(256),
})

export function createServiceTokenRoute(db: AppDb, auth: AuthInstance, logger: pino.Logger) {
  const app = new Hono()

  app.post(
    '/service-token',
    zValidator('json', serviceTokenRequestSchema),
    async (c) => {
      const { client_id, client_secret } = c.req.valid('json')

      const account = await verifyServiceAccount(db, client_id, client_secret)

      logger.info(
        { serviceName: account.serviceName, clientId: account.clientId },
        'Service token issued',
      )

      const { token } = await auth.api.signJWT({
        body: {
          payload: {
            sub: account.id,
            iss: ISSUER,
            type: 'service',
            service_name: account.serviceName,
            client_id: account.clientId,
          },
          overrideOptions: {
            jwt: {
              expirationTime: `${SERVICE_TOKEN_EXPIRY_SECONDS}s`,
            },
          },
        },
      })

      return c.json({
        access_token: token,
        token_type: 'Bearer' as const,
        expires_in: SERVICE_TOKEN_EXPIRY_SECONDS,
      })
    },
  )

  return app
}
