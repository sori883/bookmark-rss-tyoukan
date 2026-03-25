import { SignJWT, importJWK } from 'jose'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { jwks as jwksTable } from '../../../packages/db/src/schema'
import { loadTestEnv } from './env'

const ISSUER = 'bookmark-rss-auth'
const USER_TOKEN_EXPIRY = '1h'
const SERVICE_TOKEN_EXPIRY = '24h'

interface JwkRow {
  readonly id: string
  readonly privateKey: string
}

async function getPrivateKey(
  db: ReturnType<typeof drizzle>,
): Promise<JwkRow> {
  const row = await db
    .select({
      id: jwksTable.id,
      privateKey: jwksTable.privateKey,
    })
    .from(jwksTable)
    .orderBy(jwksTable.createdAt)
    .limit(1)
    .then((rows) => rows[0])

  if (!row) {
    throw new Error(
      'No JWKS key found in database. Ensure auth service has been started at least once.',
    )
  }

  return row
}

/**
 * Generate a user JWT by reading the signing key directly from the DB.
 * This avoids needing the auth service running for JWT generation.
 */
export async function generateUserJwt(userId: string): Promise<string> {
  const env = loadTestEnv()
  const sql = postgres(env.DATABASE_URL)
  const db = drizzle(sql)

  try {
    const keyRow = await getPrivateKey(db)
    const privateKeyJwk = JSON.parse(keyRow.privateKey) as JsonWebKey
    const privateKey = await importJWK(privateKeyJwk, 'RS256')

    const token = await new SignJWT({
      sub: userId,
    })
      .setProtectedHeader({ alg: 'RS256', kid: keyRow.id })
      .setIssuer(ISSUER)
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(USER_TOKEN_EXPIRY)
      .sign(privateKey)

    return token
  } finally {
    await sql.end()
  }
}

/**
 * Generate a service JWT by calling the auth service's /auth/service-token endpoint.
 * Requires the auth service to be running.
 */
export async function generateServiceJwt(): Promise<string> {
  const env = loadTestEnv()
  const url = `${env.AUTH_BASE_URL}/auth/service-token`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.AI_CLIENT_ID,
      client_secret: env.AI_CLIENT_SECRET,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Failed to get service token (${response.status}): ${body}`,
    )
  }

  const data = (await response.json()) as { access_token: string }
  return data.access_token
}

/**
 * Generate a user JWT with custom claims for testing edge cases.
 */
export async function generateCustomJwt(
  claims: Record<string, unknown>,
  expiresIn: string = USER_TOKEN_EXPIRY,
): Promise<string> {
  const env = loadTestEnv()
  const sql = postgres(env.DATABASE_URL)
  const db = drizzle(sql)

  try {
    const keyRow = await getPrivateKey(db)
    const privateKeyJwk = JSON.parse(keyRow.privateKey) as JsonWebKey
    const privateKey = await importJWK(privateKeyJwk, 'RS256')

    const token = await new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: keyRow.id })
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(privateKey)

    return token
  } finally {
    await sql.end()
  }
}
