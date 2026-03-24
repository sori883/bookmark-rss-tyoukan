import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import {
  AppError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  errorResponse,
} from '../lib/errors'

describe('error classes', () => {
  it('AppError should have correct properties', () => {
    const err = new AppError('TEST_ERROR', 'test message', 400)
    expect(err.code).toBe('TEST_ERROR')
    expect(err.message).toBe('test message')
    expect(err.statusCode).toBe(400)
    expect(err.name).toBe('AppError')
  })

  it('AppError should default to 500 status', () => {
    const err = new AppError('INTERNAL', 'fail')
    expect(err.statusCode).toBe(500)
  })

  it('UnauthorizedError should be 401', () => {
    const err = new UnauthorizedError()
    expect(err.code).toBe('UNAUTHORIZED')
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Unauthorized')
  })

  it('NotFoundError should be 404', () => {
    const err = new NotFoundError('Resource not found')
    expect(err.code).toBe('NOT_FOUND')
    expect(err.statusCode).toBe(404)
    expect(err.message).toBe('Resource not found')
  })

  it('ValidationError should be 400', () => {
    const err = new ValidationError('Bad input')
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.statusCode).toBe(400)
  })
})

describe('errorResponse', () => {
  it('should return ErrorResponse format for AppError', async () => {
    const app = new Hono()
    app.get('/test', (c) => {
      return errorResponse(c, new UnauthorizedError('bad token'))
    })

    const res = await app.request('/test')
    expect(res.status).toBe(401)

    const body = await res.json()
    expect(body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'bad token' },
    })
  })

  it('should hide internal error message in non-development env', async () => {
    const app = new Hono()
    app.get('/test', (c) => {
      return errorResponse(c, new Error('something broke'))
    })

    const res = await app.request('/test')
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  })

  it('should show error detail in development env', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const app = new Hono()
    app.get('/test', (c) => {
      return errorResponse(c, new Error('something broke'))
    })

    const res = await app.request('/test')
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'something broke' },
    })

    process.env.NODE_ENV = originalEnv
  })

  it('should return generic message for non-Error', async () => {
    const app = new Hono()
    app.get('/test', (c) => {
      return errorResponse(c, 'string error')
    })

    const res = await app.request('/test')
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  })
})
