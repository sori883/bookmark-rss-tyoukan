import { createMiddleware } from 'hono/factory'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { UnauthorizedError } from '../lib/errors.js'

export interface JwtPayload {
  readonly sub: string
  readonly email?: string
  readonly name?: string
}

export type AuthVariables = {
  jwtPayload: JwtPayload
}

const JWKS_URL =
  process.env.JWKS_URL ?? 'http://localhost:3000/auth/.well-known/jwks.json'

const JWKS = createRemoteJWKSet(new URL(JWKS_URL))

export const authMiddleware = createMiddleware<{
  Variables: AuthVariables
}>(async (c, next) => {
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
})

export function getUserId(jwtPayload: JwtPayload): string {
  return jwtPayload.sub
}
