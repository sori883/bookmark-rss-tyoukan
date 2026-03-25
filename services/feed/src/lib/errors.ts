import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: ContentfulStatusCode = 500,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super('NOT_FOUND', message, 404)
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super('VALIDATION_ERROR', message, 400)
  }
}

export function errorResponse(c: Context, error: unknown): Response {
  if (error instanceof AppError) {
    return c.json(
      { error: { code: error.code, message: error.message } },
      error.statusCode,
    )
  }

  // PostgreSQL の重複キーエラー
  if (error instanceof Error && 'code' in error && (error as { code: string }).code === '23505') {
    return c.json(
      { error: { code: 'DUPLICATE', message: 'このリソースは既に登録されています' } },
      409,
    )
  }

  return c.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
    500,
  )
}
