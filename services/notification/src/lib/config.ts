import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().default(3004),
  DATABASE_URL: z.string().min(1),
  AUTH_JWKS_URL: z.string().url(),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type EnvConfig = z.infer<typeof envSchema>

let cachedConfig: EnvConfig | undefined

export function getConfig(): EnvConfig {
  if (cachedConfig) {
    return cachedConfig
  }

  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Environment variable validation failed:\n${formatted}`)
  }

  cachedConfig = result.data
  return cachedConfig
}

/** テスト用: キャッシュをリセット */
export function resetConfigCache(): void {
  cachedConfig = undefined
}
