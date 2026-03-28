import { handle } from 'hono/aws-lambda'
import { buildApp } from './index'
import { fetchFeeds } from './services/rss-fetcher'
import { db } from './lib/db'
import { logger } from './lib/logger'

const { app } = buildApp()
const honoHandler = handle(app)

interface SchedulerEvent {
  path?: string
  httpMethod?: string
  source?: string
}

export const handler = async (event: SchedulerEvent, context: unknown) => {
  // EventBridge Scheduler からの直接 invoke を検出
  if (event.path === '/feeds/fetch' && !('requestContext' in (event as Record<string, unknown>))) {
    logger.info('feed fetch triggered by scheduler')
    try {
      const result = await fetchFeeds(db, undefined, undefined)
      logger.info({ result }, 'feed fetch completed')
      return {
        statusCode: 200,
        body: JSON.stringify({
          fetched_count: result.fetchedCount,
          new_articles_count: result.newArticlesCount,
        }),
      }
    } catch (error) {
      logger.error({ error }, 'feed fetch failed')
      return { statusCode: 500, body: JSON.stringify({ error: 'feed fetch failed' }) }
    }
  }

  // API Gateway からのリクエスト
  return honoHandler(event as Parameters<typeof honoHandler>[0], context as Parameters<typeof honoHandler>[1])
}
