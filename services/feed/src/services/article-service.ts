import { eq, and, count, desc } from 'drizzle-orm'
import { articles } from '@bookmark-rss/db'
import type { AppDb } from '../lib/db.js'
import { NotFoundError } from '../lib/errors.js'

export interface CreateArticleInput {
  readonly userId: string
  readonly feedId: string
  readonly url: string
  readonly title: string
  readonly publishedAt: string
}

export interface ListArticlesQuery {
  readonly userId?: string
  readonly feedId?: string
  readonly isRead?: boolean
  readonly page: number
  readonly limit: number
}

export async function createArticle(db: AppDb, input: CreateArticleInput) {
  const [article] = await db
    .insert(articles)
    .values({
      userId: input.userId,
      feedId: input.feedId,
      url: input.url,
      title: input.title,
      publishedAt: new Date(input.publishedAt),
    })
    .returning()

  return article
}

export async function listArticles(db: AppDb, query: ListArticlesQuery) {
  const conditions = []

  if (query.userId) {
    conditions.push(eq(articles.userId, query.userId))
  }
  if (query.feedId) {
    conditions.push(eq(articles.feedId, query.feedId))
  }
  if (query.isRead !== undefined) {
    conditions.push(eq(articles.isRead, query.isRead))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [data, [{ total }]] = await Promise.all([
    db
      .select()
      .from(articles)
      .where(where)
      .orderBy(desc(articles.publishedAt))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit),
    db
      .select({ total: count() })
      .from(articles)
      .where(where),
  ])

  return { data, total, page: query.page, limit: query.limit }
}

export async function getArticle(db: AppDb, id: string, userId: string) {
  const [article] = await db
    .select()
    .from(articles)
    .where(and(eq(articles.id, id), eq(articles.userId, userId)))
    .limit(1)

  if (!article) {
    throw new NotFoundError('Article not found')
  }

  return article
}

export async function updateArticle(
  db: AppDb,
  id: string,
  userId: string,
  data: { readonly isRead?: boolean },
) {
  const [updated] = await db
    .update(articles)
    .set({
      ...(data.isRead !== undefined ? { isRead: data.isRead } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(articles.id, id), eq(articles.userId, userId)))
    .returning()

  if (!updated) {
    throw new NotFoundError('Article not found')
  }

  return updated
}

export async function deleteArticle(db: AppDb, id: string, userId: string) {
  const [deleted] = await db
    .delete(articles)
    .where(and(eq(articles.id, id), eq(articles.userId, userId)))
    .returning({ id: articles.id })

  if (!deleted) {
    throw new NotFoundError('Article not found')
  }
}
