import {
  pgTable,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─── users ────────────────────────────────────────────
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── sessions (Better Auth) ──────────────────────────
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
})

// ─── accounts (Better Auth) ─────────────────────────
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── verifications (Better Auth) ────────────────────
export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

// ─── jwks (Better Auth JWT plugin) ──────────────────
export const jwks = pgTable('jwks', {
  id: text('id').primaryKey(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
})

// ─── feeds ────────────────────────────────────────────
export const feeds = pgTable('feeds', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  title: text('title').notNull().default(''),
  siteUrl: text('site_url').notNull().default(''),
  lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_feeds_user').on(table.userId),
])

// ─── articles ─────────────────────────────────────────
export const articles = pgTable('articles', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  feedId: text('feed_id').notNull().references(() => feeds.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  ogImageUrl: text('og_image_url'),
  isRead: boolean('is_read').notNull().default(false),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_articles_feed').on(table.feedId),
  index('idx_articles_user').on(table.userId),
  index('idx_articles_unread').on(table.isRead).where(sql`is_read = false`),
])

// ─── bookmarks ────────────────────────────────────────
export const bookmarks = pgTable('bookmarks', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  articleId: text('article_id').references(() => articles.id, { onDelete: 'set null' }),
  url: text('url').notNull(),
  title: text('title').notNull(),
  contentMarkdown: text('content_markdown').notNull().default(''),
  searchVector: text('search_vector'), // tsvector は Drizzle 未対応のため SQL マイグレーションで GIN インデックス作成
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_bookmarks_user').on(table.userId),
  uniqueIndex('idx_bookmarks_url_user').on(table.userId, table.url),
])

// ─── settings ─────────────────────────────────────────
export const settings = pgTable('settings', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  webhookUrl: text('webhook_url'),
  webhookType: text('webhook_type'), // 'slack' | 'discord'
  notificationHour: integer('notification_hour').notNull().default(9), // 0-23
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── service_accounts ─────────────────────────────────
export const serviceAccounts = pgTable('service_accounts', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  serviceName: text('service_name').notNull(),
  clientId: text('client_id').notNull().unique(),
  clientSecretHash: text('client_secret_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── notifications ────────────────────────────────────
export const notifications = pgTable('notifications', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('webhook'),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── jobs ─────────────────────────────────────────────
export const jobs = pgTable('jobs', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  jobType: text('job_type').notNull(),
  payload: jsonb('payload').default({}),
  status: text('status').notNull().default('pending'), // pending | processing | completed | failed
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  error: text('error'),
}, (table) => [
  index('idx_jobs_pending').on(table.jobType, table.createdAt).where(sql`status = 'pending'`),
])
