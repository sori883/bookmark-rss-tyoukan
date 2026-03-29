import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders, NONCE } from 'hono/secure-headers'
import { getConfig } from './lib/config'
import { createLogger } from './lib/logger'
import { createDb } from './lib/db'
import { createAuth } from './auth'
import { createServiceTokenRoute } from './routes/service-token'
import { createJwksRoute } from './routes/jwks'
import { createMeRoute } from './routes/me'
import { createDeviceRoute } from './routes/device'
import { errorResponse } from './lib/errors'

export function buildApp() {
  const config = getConfig()
  const logger = createLogger(config.LOG_LEVEL)
  const { db } = createDb(config.DATABASE_URL)

  const cliCallbackOrigins =
    config.NODE_ENV !== 'production'
      ? Array.from({ length: 10 }, (_, i) => `http://localhost:${18923 + i}`)
      : []

  const auth = createAuth({
    db,
    googleClientId: config.GOOGLE_CLIENT_ID,
    googleClientSecret: config.GOOGLE_CLIENT_SECRET,
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.BETTER_AUTH_URL,
    cookieDomain: config.COOKIE_DOMAIN,
    trustedOrigins: [
      config.WEB_ORIGIN,
      // CLI OAuth コールバック（開発環境のみ、ポート 18923〜18932）
      ...cliCallbackOrigins,
    ],
  })

  const app = new Hono()

  // CORS
  app.use(
    '*',
    cors({
      origin: config.WEB_ORIGIN,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  )

  // Security headers (HSTS, X-Content-Type-Options, etc.)
  // デバイスフローページ用にnonce-basedのCSPを使用
  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: [NONCE],
        styleSrc: [NONCE],
      },
    }),
  )

  // Global error handler
  app.onError((err, c) => {
    logger.error({ err, path: c.req.path, method: c.req.method }, 'Request error')
    return errorResponse(c, err)
  })

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok' }))

  // Custom routes under /auth — registered BEFORE Better Auth wildcard
  app.route('/auth', createServiceTokenRoute(db, auth, logger))
  app.route('/auth', createJwksRoute(db))
  app.route('/auth', createMeRoute(auth))
  app.route('/auth', createDeviceRoute(db, auth))

  // Better Auth handler — handles /auth/* routes (sign-in, callback, session, etc.)
  app.on(['GET', 'POST'], '/auth/*', (c) => {
    return auth.handler(c.req.raw)
  })

  return { app, config, logger, auth }
}

function startServer() {
  const { app, config, logger } = buildApp()

  serve({ fetch: app.fetch, port: config.PORT }, () => {
    logger.info({ port: config.PORT }, 'auth service started')
  })
}

startServer()
