import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { jwt, bearer } from 'better-auth/plugins'
import * as schema from '@bookmark-rss/db'
import type { AppDb } from './lib/db'

export type AuthInstance = ReturnType<typeof createAuth>

export function createAuth(options: {
  db: AppDb
  googleClientId: string
  googleClientSecret: string
  secret: string
  baseURL: string
  trustedOrigins: string[]
}) {
  return betterAuth({
    database: drizzleAdapter(options.db, {
      provider: 'pg',
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
        jwks: schema.jwks,
      },
    }),
    basePath: '/auth',
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: options.trustedOrigins,
    socialProviders: {
      google: {
        clientId: options.googleClientId,
        clientSecret: options.googleClientSecret,
      },
    },
    advanced: {
      defaultCookieAttributes: {
        sameSite: 'none',
        secure: true,
      },
      useSecureCookies: true,
    },
    account: {
      accountLinking: { enabled: true },
      storeStateStrategy: 'database',
      skipStateCookieCheck: true,
    },
    plugins: [
      jwt({
        jwks: {
          disablePrivateKeyEncryption: true,
        },
      }),
      bearer(),
    ],
  })
}
