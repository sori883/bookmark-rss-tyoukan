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
    process.env.AUTH_JWKS_URL = 'http://localhost:3000/auth/.well-known/jwks.json'
  }

  it('should parse valid environment variables with defaults', () => {
    setRequiredEnv()
    const config = getConfig()

    expect(config.PORT).toBe(3004)
    expect(config.DATABASE_URL).toBe('postgres://test:test@localhost:5432/test')
    expect(config.AUTH_JWKS_URL).toBe('http://localhost:3000/auth/.well-known/jwks.json')
    expect(config.LOG_LEVEL).toBe('info')
    expect(['development', 'test']).toContain(config.NODE_ENV)
  })

  it('should use custom PORT when provided', () => {
    setRequiredEnv()
    process.env.PORT = '5000'
    const config = getConfig()

    expect(config.PORT).toBe(5000)
  })

  it('should throw when DATABASE_URL is missing', () => {
    process.env.AUTH_JWKS_URL = 'http://localhost:3000/auth/.well-known/jwks.json'

    expect(() => getConfig()).toThrow('Environment variable validation failed')
  })

  it('should throw when AUTH_JWKS_URL is missing', () => {
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test'

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
