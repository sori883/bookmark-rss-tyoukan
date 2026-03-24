import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { SignJWT, importJWK } from 'jose'
import { eq } from 'drizzle-orm'
import { jwks as jwksTable } from '@bookmark-rss/db'
import { verifyServiceAccount } from '../services/service-account'
import { AppError } from '../lib/errors'
import type { AppDb } from '../lib/db'
import type pino from 'pino'

const SERVICE_TOKEN_EXPIRY_SECONDS = 86400 // 24h
const ISSUER = 'bookmark-rss-auth'

const serviceTokenRequestSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
})

export function createServiceTokenRoute(db: AppDb, logger: pino.Logger) {
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

      const privateKeyRow = await db
        .select()
        .from(jwksTable)
        .orderBy(jwksTable.createdAt)
        .limit(1)
        .then((rows) => rows[0])

      if (!privateKeyRow) {
        throw new AppError(
          'INTERNAL_ERROR',
          'No signing key available. Ensure Better Auth JWT plugin has initialized.',
          500,
        )
      }

      const privateKeyJwk = JSON.parse(privateKeyRow.privateKey) as JsonWebKey
      const privateKey = await importJWK(privateKeyJwk, 'RS256')

      const token = await new SignJWT({
        type: 'service',
        service_name: account.serviceName,
        client_id: account.clientId,
      })
        .setProtectedHeader({
          alg: 'RS256',
          kid: privateKeyRow.id,
        })
        .setIssuer(ISSUER)
        .setSubject(account.id)
        .setIssuedAt()
        .setExpirationTime(`${SERVICE_TOKEN_EXPIRY_SECONDS}s`)
        .sign(privateKey)

      return c.json({
        access_token: token,
        token_type: 'Bearer' as const,
        expires_in: SERVICE_TOKEN_EXPIRY_SECONDS,
      })
    },
  )

  return app
}
