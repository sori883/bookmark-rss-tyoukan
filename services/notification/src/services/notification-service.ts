import { eq, desc, and, count, SQL } from 'drizzle-orm'
import { notifications } from '@bookmark-rss/db'
import type { AppDb } from '../lib/db'
import type pino from 'pino'
import { sendWebhook } from './webhook-sender'
import { NotFoundError } from '../lib/errors'

export interface CreateNotificationInput {
  readonly userId: string
  readonly message: string
  readonly webhookMessage?: string
}

export interface CreateNotificationResult {
  readonly id: string
  readonly webhookSent: boolean
}

export interface NotificationRow {
  readonly id: string
  readonly userId: string
  readonly type: string
  readonly message: string
  readonly isRead: boolean
  readonly sentAt: Date
}

export interface ListNotificationsInput {
  readonly userId: string
  readonly page: number
  readonly limit: number
  readonly isRead?: boolean
}

export interface PaginatedNotifications {
  readonly data: readonly NotificationRow[]
  readonly total: number
  readonly page: number
  readonly limit: number
}

export async function createNotification(
  db: AppDb,
  input: CreateNotificationInput,
  logger: pino.Logger,
): Promise<CreateNotificationResult> {
  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      message: input.message,
    })
    .returning({ id: notifications.id })

  const webhookText = input.webhookMessage ?? input.message
  const webhookResult = await sendWebhook(db, input.userId, webhookText, logger)

  return {
    id: row.id,
    webhookSent: webhookResult.sent,
  }
}

export async function listNotifications(
  db: AppDb,
  input: ListNotificationsInput,
): Promise<PaginatedNotifications> {
  const conditions: SQL[] = [eq(notifications.userId, input.userId)]

  if (input.isRead !== undefined) {
    conditions.push(eq(notifications.isRead, input.isRead))
  }

  const where = and(...conditions)

  const [totalResult, data] = await Promise.all([
    db.select({ count: count() }).from(notifications).where(where),
    db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.sentAt))
      .limit(input.limit)
      .offset((input.page - 1) * input.limit),
  ])

  return {
    data,
    total: totalResult[0].count,
    page: input.page,
    limit: input.limit,
  }
}

export async function markAsRead(
  db: AppDb,
  notificationId: string,
  userId: string,
  isRead: boolean,
): Promise<NotificationRow> {
  const [updated] = await db
    .update(notifications)
    .set({ isRead })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning()

  if (!updated) {
    throw new NotFoundError('Notification not found')
  }

  return updated
}
