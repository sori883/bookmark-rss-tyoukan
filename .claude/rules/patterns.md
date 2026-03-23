# 共通パターン

## APIレスポンス形式

docs/04.API型定義.md で定義済み。ページネーションとエラーの共通型:

```typescript
// ページネーション
type PaginatedResponse<T> = {
  data: T[]
  total: number
  page: number
  limit: number
}

// エラー
type ErrorResponse = {
  error: {
    code: string    // "NOT_FOUND", "UNAUTHORIZED", "VALIDATION_ERROR" 等
    message: string
  }
}
```

## Hono ルートパターン

```typescript
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

const app = new Hono()

// バリデーション付きルート
app.post('/feeds',
  zValidator('json', z.object({ url: z.string().url() })),
  async (c) => {
    const { url } = c.req.valid('json')
    const feed = await feedService.create(url)
    return c.json(feed, 201)
  }
)
```

## サービスレイヤーパターン

ルートハンドラからビジネスロジックを分離:

```typescript
// services/feed/src/services/feed-service.ts
export class FeedService {
  constructor(private db: DrizzleDB) {}

  async create(url: string): Promise<Feed> {
    // ビジネスロジック
  }
}
```

## JWT検証ミドルウェア

```typescript
import { createMiddleware } from 'hono/factory'
import { jwtVerify, createRemoteJWKSet } from 'jose'

const JWKS = createRemoteJWKSet(new URL('http://localhost:3000/auth/.well-known/jwks.json'))

export const authMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) throw new HTTPException(401)
  const { payload } = await jwtVerify(token, JWKS)
  c.set('user', payload)
  await next()
})
```

## OpenAPI との整合性

実装は `openapi/` 配下の仕様に完全準拠すること。型の不一致があれば実装側を修正する。
