import { eq, and, inArray } from 'drizzle-orm'
import { feeds } from '@bookmark-rss/db'
import type { AppDb } from '../lib/db.js'
import { NotFoundError } from '../lib/errors.js'
import type { OpmlFeed } from '../lib/opml-parser.js'

export interface CreateFeedInput {
  readonly userId: string
  readonly url: string
  readonly title?: string
  readonly siteUrl?: string
}

export async function createFeed(db: AppDb, input: CreateFeedInput) {
  const [feed] = await db
    .insert(feeds)
    .values({
      userId: input.userId,
      url: input.url,
      title: input.title ?? '',
      siteUrl: input.siteUrl ?? '',
    })
    .returning()

  return feed
}

export async function listFeeds(db: AppDb, userId: string) {
  return db.select().from(feeds).where(eq(feeds.userId, userId))
}

export async function deleteFeed(db: AppDb, id: string, userId: string) {
  const [deleted] = await db
    .delete(feeds)
    .where(and(eq(feeds.id, id), eq(feeds.userId, userId)))
    .returning({ id: feeds.id })

  if (!deleted) {
    throw new NotFoundError('Feed not found')
  }
}

export async function getFeedById(db: AppDb, id: string, userId: string) {
  const [feed] = await db
    .select()
    .from(feeds)
    .where(and(eq(feeds.id, id), eq(feeds.userId, userId)))
    .limit(1)

  if (!feed) {
    throw new NotFoundError('Feed not found')
  }

  return feed
}

export async function getFeedsByIds(db: AppDb, ids: readonly string[]) {
  if (ids.length === 0) return []
  return db.select().from(feeds).where(inArray(feeds.id, [...ids]))
}

export async function updateLastFetchedAt(db: AppDb, feedId: string) {
  await db
    .update(feeds)
    .set({ lastFetchedAt: new Date() })
    .where(eq(feeds.id, feedId))
}

export async function getAllFeeds(db: AppDb) {
  return db.select().from(feeds)
}

export async function importOpml(
  db: AppDb,
  userId: string,
  opmlFeeds: readonly OpmlFeed[],
) {
  if (opmlFeeds.length === 0) return []

  const imported = await db
    .insert(feeds)
    .values(
      opmlFeeds.map((f) => ({
        userId,
        url: f.url,
        title: f.title,
        siteUrl: f.siteUrl,
      })),
    )
    .onConflictDoNothing()
    .returning()

  return imported
}
