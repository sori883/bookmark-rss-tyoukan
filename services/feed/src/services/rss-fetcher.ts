import RssParser from 'rss-parser'
import { eq, and } from 'drizzle-orm'
import { feeds, articles } from '@bookmark-rss/db'
import type { AppDb } from '../lib/db.js'
import { logger } from '../lib/logger.js'
import * as feedService from './feed-service.js'

const parser = new RssParser()

export interface FetchResult {
  readonly fetchedCount: number
  readonly newArticlesCount: number
}

interface ParsedArticle {
  readonly url: string
  readonly title: string
  readonly description: string
  readonly ogImageUrl: string | null
  readonly publishedAt: Date | null
}

function extractImageUrl(
  item: RssParser.Item & Record<string, unknown>,
): string | null {
  // enclosure（image type）
  const enclosure = item.enclosure as
    | { url?: string; type?: string }
    | undefined
  if (enclosure?.url && enclosure.type?.startsWith('image/')) {
    return enclosure.url
  }

  // media:content or media:thumbnail（RSS 2.0 / Atom）
  const mediaContent = item['media:content'] as
    | { $?: { url?: string } }
    | undefined
  if (mediaContent?.$?.url) {
    return mediaContent.$.url
  }

  const mediaThumbnail = item['media:thumbnail'] as
    | { $?: { url?: string } }
    | undefined
  if (mediaThumbnail?.$?.url) {
    return mediaThumbnail.$.url
  }

  return null
}

function parseArticles(
  feed: RssParser.Output<Record<string, unknown>>,
): readonly ParsedArticle[] {
  return (feed.items ?? [])
    .filter((item) => item.link)
    .map((item) => ({
      url: item.link!,
      title: item.title ?? 'Untitled',
      description: item.contentSnippet ?? item.content ?? '',
      ogImageUrl: extractImageUrl(item as RssParser.Item & Record<string, unknown>),
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
    }))
}

async function fetchSingleFeed(
  db: AppDb,
  feedRecord: { readonly id: string; readonly userId: string; readonly url: string },
): Promise<number> {
  let parsed: RssParser.Output<Record<string, unknown>>
  try {
    parsed = await parser.parseURL(feedRecord.url)
  } catch (err) {
    logger.warn({ feedId: feedRecord.id, url: feedRecord.url, err }, 'Failed to fetch RSS')
    return 0
  }

  const parsedArticles = parseArticles(parsed)
  if (parsedArticles.length === 0) return 0

  const existingUrls = new Set(
    (
      await db
        .select({ url: articles.url })
        .from(articles)
        .where(eq(articles.feedId, feedRecord.id))
    ).map((row) => row.url),
  )

  const newArticles = parsedArticles.filter((a) => !existingUrls.has(a.url))

  if (newArticles.length > 0) {
    await db.insert(articles).values(
      newArticles.map((a) => ({
        userId: feedRecord.userId,
        feedId: feedRecord.id,
        url: a.url,
        title: a.title,
        description: a.description,
        ogImageUrl: a.ogImageUrl,
        publishedAt: a.publishedAt,
      })),
    )
  }

  await feedService.updateLastFetchedAt(db, feedRecord.id)

  logger.info(
    { feedId: feedRecord.id, newCount: newArticles.length },
    'Feed fetched',
  )

  return newArticles.length
}

export async function fetchFeeds(
  db: AppDb,
  feedId?: string,
  userId?: string,
): Promise<FetchResult> {
  const feedList = await (async () => {
    if (feedId && userId) {
      return db
        .select()
        .from(feeds)
        .where(and(eq(feeds.id, feedId), eq(feeds.userId, userId)))
        .limit(1)
    }
    if (feedId) {
      return db.select().from(feeds).where(eq(feeds.id, feedId)).limit(1)
    }
    if (userId) {
      return feedService.listFeeds(db, userId)
    }
    return feedService.getAllFeeds(db)
  })()

  const counts: number[] = []
  for (const feed of feedList) {
    counts.push(await fetchSingleFeed(db, feed))
  }

  return {
    fetchedCount: feedList.length,
    newArticlesCount: counts.reduce((sum, c) => sum + c, 0),
  }
}
