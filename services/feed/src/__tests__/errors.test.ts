import { Hono } from 'hono'
import {
  AppError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  errorResponse,
} from '../lib/errors.js'

describe('Error classes', () => {
  it('UnauthorizedError should have 401 status', () => {
    const err = new UnauthorizedError()
    expect(err.code).toBe('UNAUTHORIZED')
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Unauthorized')
  })

  it('NotFoundError should have 404 status', () => {
    const err = new NotFoundError('Feed not found')
    expect(err.code).toBe('NOT_FOUND')
    expect(err.statusCode).toBe(404)
    expect(err.message).toBe('Feed not found')
  })

  it('ValidationError should have 400 status', () => {
    const err = new ValidationError('Invalid URL')
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.statusCode).toBe(400)
  })

  it('AppError should default to 500', () => {
    const err = new AppError('CUSTOM', 'something broke')
    expect(err.statusCode).toBe(500)
  })
})

describe('errorResponse', () => {
  it('should format AppError to standard response', async () => {
    const app = new Hono()
    app.get('/test', (c) => errorResponse(c, new NotFoundError('not here')))

    const res = await app.request('/test')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toEqual({
      error: { code: 'NOT_FOUND', message: 'not here' },
    })
  })

  it('should handle unknown errors as 500', async () => {
    const app = new Hono()
    app.get('/test', (c) => errorResponse(c, new Error('unexpected')))

    const res = await app.request('/test')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    })
  })

  it('should handle non-Error values as 500', async () => {
    const app = new Hono()
    app.get('/test', (c) => errorResponse(c, 'string error'))

    const res = await app.request('/test')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
