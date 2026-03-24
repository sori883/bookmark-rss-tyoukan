import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { serviceAccounts } from '@bookmark-rss/db'
import { UnauthorizedError } from '../lib/errors'
import type { AppDb } from '../lib/db'

export interface ServiceAccountResult {
  readonly id: string
  readonly serviceName: string
  readonly clientId: string
}

export async function verifyServiceAccount(
  db: AppDb,
  clientId: string,
  clientSecret: string,
): Promise<ServiceAccountResult> {
  const account = await db
    .select()
    .from(serviceAccounts)
    .where(eq(serviceAccounts.clientId, clientId))
    .limit(1)
    .then((rows) => rows[0])

  if (!account) {
    throw new UnauthorizedError('Invalid client credentials')
  }

  const isValid = await bcrypt.compare(clientSecret, account.clientSecretHash)

  if (!isValid) {
    throw new UnauthorizedError('Invalid client credentials')
  }

  return {
    id: account.id,
    serviceName: account.serviceName,
    clientId: account.clientId,
  }
}
