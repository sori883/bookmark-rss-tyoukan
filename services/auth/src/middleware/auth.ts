import { createMiddleware } from 'hono/factory'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import { UnauthorizedError } from '../lib/errors'

export interface JwtPayload {
  readonly sub: string
  readonly type?: string
  readonly service_name?: string
  readonly client_id?: string
  readonly email?: string
  readonly name?: string
}

export function createAuthMiddleware(jwksUrl: string) {
  const JWKS = createRemoteJWKSet(new URL(jwksUrl))

  return createMiddleware<{ Variables: { jwtPayload: JwtPayload } }>(
    async (c, next) => {
      const authHeader = c.req.header('Authorization')
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : undefined

      if (!token) {
        throw new UnauthorizedError('Missing Bearer token')
      }

      try {
        const { payload } = await jwtVerify(token, JWKS)
        c.set('jwtPayload', payload as unknown as JwtPayload)
        await next()
      } catch {
        throw new UnauthorizedError('Invalid or expired token')
      }
    },
  )
}
