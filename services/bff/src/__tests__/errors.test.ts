import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  errorResponse,
} from '../lib/errors.js'

describe('AppError classes', () => {
  it('should create UnauthorizedError with correct fields', () => {
    const err = new UnauthorizedError()
    expect(err.code).toBe('UNAUTHORIZED')
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Unauthorized')
  })

  it('should create NotFoundError with correct fields', () => {
    const err = new NotFoundError('Feed not found')
    expect(err.code).toBe('NOT_FOUND')
    expect(err.statusCode).toBe(404)
    expect(err.message).toBe('Feed not found')
  })

  it('should create ValidationError with correct fields', () => {
    const err = new ValidationError()
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.statusCode).toBe(400)
  })
})

describe('errorResponse', () => {
  it('should return structured error for AppError', async () => {
    const app = new Hono()
    app.get('/', () => {
      throw new NotFoundError('Not found')
    })
    app.onError((err, c) => errorResponse(c, err))

    const res = await app.request('/')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBe('Not found')
  })

  it('should return 500 for unknown errors', async () => {
    const app = new Hono()
    app.get('/', () => {
      throw new Error('unexpected')
    })
    app.onError((err, c) => errorResponse(c, err))

    const res = await app.request('/')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
