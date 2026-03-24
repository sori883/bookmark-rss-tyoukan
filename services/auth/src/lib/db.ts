import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@bookmark-rss/db'

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl)
  const db = drizzle(client, { schema })
  return { db, client }
}

export type AppDb = ReturnType<typeof createDb>['db']
