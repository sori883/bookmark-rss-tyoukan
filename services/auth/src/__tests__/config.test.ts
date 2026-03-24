import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getConfig, resetConfigCache } from '../lib/config'

describe('config', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetConfigCache()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    resetConfigCache()
  })

  function setRequiredEnv() {
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test'
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
    process.env.BETTER_AUTH_SECRET = 'test-better-auth-secret'
    process.env.BETTER_AUTH_URL = 'http://localhost:3000'
    process.env.WEB_ORIGIN = 'http://localhost:5173'
  }

  it('should parse valid environment variables', () => {
    setRequiredEnv()
    const config = getConfig()

    expect(config.PORT).toBe(3000)
    expect(config.DATABASE_URL).toBe('postgres://test:test@localhost:5432/test')
    expect(config.GOOGLE_CLIENT_ID).toBe('test-google-client-id')
    expect(config.GOOGLE_CLIENT_SECRET).toBe('test-google-client-secret')
    expect(config.BETTER_AUTH_SECRET).toBe('test-better-auth-secret')
    expect(config.LOG_LEVEL).toBe('info')
    expect(['development', 'test']).toContain(config.NODE_ENV)
  })

  it('should use custom PORT when provided', () => {
    setRequiredEnv()
    process.env.PORT = '4000'
    const config = getConfig()

    expect(config.PORT).toBe(4000)
  })

  it('should throw when DATABASE_URL is missing', () => {
    process.env.GOOGLE_CLIENT_ID = 'test'
    process.env.GOOGLE_CLIENT_SECRET = 'test'
    process.env.BETTER_AUTH_SECRET = 'test'

    expect(() => getConfig()).toThrow('Environment variable validation failed')
  })

  it('should throw when GOOGLE_CLIENT_ID is missing', () => {
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test'
    process.env.GOOGLE_CLIENT_SECRET = 'test'
    process.env.BETTER_AUTH_SECRET = 'test'

    expect(() => getConfig()).toThrow('Environment variable validation failed')
  })

  it('should throw when BETTER_AUTH_SECRET is missing', () => {
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test'
    process.env.GOOGLE_CLIENT_ID = 'test'
    process.env.GOOGLE_CLIENT_SECRET = 'test'

    expect(() => getConfig()).toThrow('Environment variable validation failed')
  })

  it('should validate LOG_LEVEL enum', () => {
    setRequiredEnv()
    process.env.LOG_LEVEL = 'debug'
    const config = getConfig()

    expect(config.LOG_LEVEL).toBe('debug')
  })

  it('should reject invalid LOG_LEVEL', () => {
    setRequiredEnv()
    process.env.LOG_LEVEL = 'verbose'

    expect(() => getConfig()).toThrow('Environment variable validation failed')
  })

  it('should cache config after first call', () => {
    setRequiredEnv()
    const config1 = getConfig()
    const config2 = getConfig()

    expect(config1).toBe(config2)
  })
})
