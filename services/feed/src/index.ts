import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { logger } from './lib/logger.js'
import { errorResponse } from './lib/errors.js'
import feedsRoute from './routes/feeds.js'
import articlesRoute from './routes/articles.js'
import bookmarksRoute from './routes/bookmarks.js'
import settingsRoute from './routes/settings.js'

export function buildApp() {
  const app = new Hono()

  app.use(
    '*',
    cors({
      origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    }),
  )

  // Security headers (HSTS, X-Content-Type-Options, etc.)
  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'none'"],
      },
    }),
  )

  app.get('/health', (c) => c.json({ status: 'ok' }))

  app.route('/feeds', feedsRoute)
  app.route('/articles', articlesRoute)
  app.route('/bookmarks', bookmarksRoute)
  app.route('/settings', settingsRoute)

  app.onError((err, c) => {
    logger.error({ err, path: c.req.path, method: c.req.method }, 'Request error')
    return errorResponse(c, err)
  })

  return { app }
}

function startServer() {
  const { app } = buildApp()
  const port = Number(process.env.PORT ?? 3001)
  logger.info({ port }, 'feed service starting')
  serve({ fetch: app.fetch, port })
}

startServer()
