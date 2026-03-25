import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from './lib/logger.js'
import { errorResponse } from './lib/errors.js'
import feedsRoute from './routes/feeds.js'
import articlesRoute from './routes/articles.js'
import bookmarksRoute from './routes/bookmarks.js'
import notificationsRoute from './routes/notifications.js'
import settingsRoute from './routes/settings.js'

export function buildApp() {
  const app = new Hono()

  app.get('/health', (c) => c.json({ status: 'ok' }))

  app.route('/feeds', feedsRoute)
  app.route('/articles', articlesRoute)
  app.route('/bookmarks', bookmarksRoute)
  app.route('/notifications', notificationsRoute)
  app.route('/settings', settingsRoute)

  app.onError((err, c) => {
    logger.error({ err, path: c.req.path, method: c.req.method }, 'Request error')
    return errorResponse(c, err)
  })

  return { app }
}

function startServer() {
  const { app } = buildApp()
  const port = Number(process.env.PORT ?? 3010)
  logger.info({ port }, 'bff service starting')
  serve({ fetch: app.fetch, port })
}

startServer()
