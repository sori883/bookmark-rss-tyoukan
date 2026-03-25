import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import {
  users,
  serviceAccounts,
  settings,
} from '../packages/db/src/schema'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.test from project root
config({ path: resolve(__dirname, '..', '.env.test') })

const BCRYPT_ROUNDS = 10

interface SeedConfig {
  readonly databaseUrl: string
  readonly aiClientId: string
  readonly aiClientSecret: string
  readonly testWebhookUrl: string | undefined
  readonly testWebhookType: string
}

function loadSeedConfig(): SeedConfig {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required in .env.test')
  }

  const aiClientId = process.env.AI_CLIENT_ID
  if (!aiClientId) {
    throw new Error('AI_CLIENT_ID is required in .env.test')
  }

  const aiClientSecret = process.env.AI_CLIENT_SECRET
  if (!aiClientSecret) {
    throw new Error('AI_CLIENT_SECRET is required in .env.test')
  }

  return {
    databaseUrl,
    aiClientId,
    aiClientSecret,
    testWebhookUrl: process.env.TEST_WEBHOOK_URL,
    testWebhookType: process.env.TEST_WEBHOOK_TYPE ?? 'discord',
  }
}

async function seedUser(
  db: ReturnType<typeof drizzle>,
): Promise<void> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.id, 'test-user-1'))
    .then((rows) => rows[0])

  if (existing) {
    console.info('[seed] users: test-user-1 already exists, skipping')
    return
  }

  await db.insert(users).values({
    id: 'test-user-1',
    email: 'test@example.com',
    name: 'Test User',
    emailVerified: true,
  })

  console.info('[seed] users: inserted test-user-1')
}

async function seedServiceAccount(
  db: ReturnType<typeof drizzle>,
  seedConfig: SeedConfig,
): Promise<void> {
  const existing = await db
    .select()
    .from(serviceAccounts)
    .where(eq(serviceAccounts.clientId, seedConfig.aiClientId))
    .then((rows) => rows[0])

  if (existing) {
    // Update the secret hash in case it changed
    const secretHash = await bcrypt.hash(
      seedConfig.aiClientSecret,
      BCRYPT_ROUNDS,
    )
    await db
      .update(serviceAccounts)
      .set({ clientSecretHash: secretHash })
      .where(eq(serviceAccounts.clientId, seedConfig.aiClientId))

    console.info('[seed] service_accounts: ai account already exists, updated secret hash')
    return
  }

  const secretHash = await bcrypt.hash(
    seedConfig.aiClientSecret,
    BCRYPT_ROUNDS,
  )

  await db.insert(serviceAccounts).values({
    serviceName: 'ai',
    clientId: seedConfig.aiClientId,
    clientSecretHash: secretHash,
  })

  console.info('[seed] service_accounts: inserted ai service account')
}

async function seedSettings(
  db: ReturnType<typeof drizzle>,
  seedConfig: SeedConfig,
): Promise<void> {
  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.userId, 'test-user-1'))
    .then((rows) => rows[0])

  if (existing) {
    // Update webhook settings in case they changed
    await db
      .update(settings)
      .set({
        webhookUrl: seedConfig.testWebhookUrl ?? null,
        webhookType: seedConfig.testWebhookType,
      })
      .where(eq(settings.userId, 'test-user-1'))

    console.info('[seed] settings: test-user-1 settings already exist, updated')
    return
  }

  await db.insert(settings).values({
    userId: 'test-user-1',
    webhookUrl: seedConfig.testWebhookUrl ?? null,
    webhookType: seedConfig.testWebhookType,
  })

  console.info('[seed] settings: inserted test-user-1 settings')
}

// JWKS鍵はBetter Authが初回リクエスト時に自動生成するため、seedでは作成しない

async function main(): Promise<void> {
  const seedConfig = loadSeedConfig()

  console.info('[seed] Connecting to database...')
  const sql = postgres(seedConfig.databaseUrl)
  const db = drizzle(sql)

  try {
    // JWKS鍵はBetter Authが初回リクエスト時に自動生成する
    await seedUser(db)
    await seedServiceAccount(db, seedConfig)
    await seedSettings(db, seedConfig)
    console.info('[seed] All test data seeded successfully')
  } finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error('[seed] Failed to seed test data:', err)
  process.exit(1)
})
