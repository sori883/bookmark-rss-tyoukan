import { eq, and, count, desc, sql } from 'drizzle-orm'
import { articles, bookmarks } from '@bookmark-rss/db'
import type { AppDb } from '../lib/db.js'
import { NotFoundError, ValidationError } from '../lib/errors.js'
import { extractContent } from '../lib/readability.js'

export interface CreateBookmarkInput {
  readonly userId: string
  readonly articleId?: string
  readonly url?: string
}

export interface ListBookmarksQuery {
  readonly userId: string
  readonly page: number
  readonly limit: number
}

export interface SearchBookmarksQuery {
  readonly userId: string
  readonly q: string
  readonly page: number
  readonly limit: number
}

async function resolveBookmarkTarget(
  db: AppDb,
  input: CreateBookmarkInput,
): Promise<{ readonly url: string; readonly articleId: string | null }> {
  if (input.articleId) {
    const [article] = await db
      .select()
      .from(articles)
      .where(
        and(eq(articles.id, input.articleId), eq(articles.userId, input.userId)),
      )
      .limit(1)

    if (!article) {
      throw new NotFoundError('Article not found')
    }

    return { url: article.url, articleId: article.id }
  }

  if (input.url) {
    return { url: input.url, articleId: null }
  }

  throw new ValidationError('Either article_id or url is required')
}

export async function createBookmark(db: AppDb, input: CreateBookmarkInput) {
  const target = await resolveBookmarkTarget(db, input)
  const extracted = await extractContent(target.url)

  const [bookmark] = await db
    .insert(bookmarks)
    .values({
      userId: input.userId,
      articleId: target.articleId,
      url: target.url,
      title: extracted.title || target.url,
      contentMarkdown: extracted.markdown,
    })
    .returning()

  return bookmark
}

export async function listBookmarks(db: AppDb, query: ListBookmarksQuery) {
  const where = eq(bookmarks.userId, query.userId)

  const [data, [{ total }]] = await Promise.all([
    db
      .select()
      .from(bookmarks)
      .where(where)
      .orderBy(desc(bookmarks.createdAt))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit),
    db.select({ total: count() }).from(bookmarks).where(where),
  ])

  return { data, total, page: query.page, limit: query.limit }
}

export async function getBookmark(db: AppDb, id: string, userId: string) {
  const [bookmark] = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .limit(1)

  if (!bookmark) {
    throw new NotFoundError('Bookmark not found')
  }

  return bookmark
}

export async function deleteBookmark(db: AppDb, id: string, userId: string) {
  const [deleted] = await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning({ id: bookmarks.id })

  if (!deleted) {
    throw new NotFoundError('Bookmark not found')
  }
}

export async function searchBookmarks(db: AppDb, query: SearchBookmarksQuery) {
  const pattern = `%${query.q}%`
  const where = and(
    eq(bookmarks.userId, query.userId),
    sql`(${bookmarks.title} ILIKE ${pattern} OR ${bookmarks.contentMarkdown} ILIKE ${pattern})`,
  )

  const [data, [{ total }]] = await Promise.all([
    db
      .select()
      .from(bookmarks)
      .where(where)
      .orderBy(desc(bookmarks.createdAt))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit),
    db.select({ total: count() }).from(bookmarks).where(where),
  ])

  return { data, total, page: query.page, limit: query.limit }
}
