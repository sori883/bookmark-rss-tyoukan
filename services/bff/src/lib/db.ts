import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@bookmark-rss/db'

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://bookmark:bookmark@localhost:5432/bookmark_rss'

const client = postgres(DATABASE_URL)

export const db = drizzle(client, { schema })

export type AppDb = typeof db
