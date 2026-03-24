import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getConfig } from './lib/config'
import { createLogger } from './lib/logger'
import { createDb } from './lib/db'
import { errorResponse } from './lib/errors'
import { createAuthMiddleware } from './middleware/auth'
import { createNotificationRoutes } from './routes/notifications'

export function buildApp() {
  const config = getConfig()
  const logger = createLogger(config.LOG_LEVEL)
  const { db } = createDb(config.DATABASE_URL)
  const authMiddleware = createAuthMiddleware(config.AUTH_JWKS_URL)

  const app = new Hono()

  // CORS
  app.use(
    '*',
    cors({
      origin: config.WEB_ORIGIN,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  )

  // Global error handler
  app.onError((err, c) => {
    logger.error({ err, path: c.req.path, method: c.req.method }, 'Request error')
    return errorResponse(c, err)
  })

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok' }))

  // Auth middleware for all notification routes
  const notificationRoutes = createNotificationRoutes(db, logger)
  app.use('/notify', authMiddleware)
  app.use('/notifications/*', authMiddleware)
  app.use('/notifications', authMiddleware)
  app.route('/', notificationRoutes)

  return { app, config, logger }
}

function startServer() {
  const { app, config, logger } = buildApp()

  serve({ fetch: app.fetch, port: config.PORT }, () => {
    logger.info({ port: config.PORT }, 'notification service started')
  })
}

startServer()

export default buildApp
