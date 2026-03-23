---
paths:
  - "services/{auth,bff,feed,notification}/**/*.ts"
  - "packages/db/**/*.ts"
---

# TypeScript バックエンドサービス規約

## フレームワーク: Hono

- ルート分割は `app.route()` を使用
- バリデーションは `@hono/zod-validator` を使用
- エラーは `HTTPException` を throw
- ミドルウェアは `createMiddleware()` で作成

```typescript
// ルートの書き方
const feedRoutes = new Hono()
  .get('/', zValidator('query', listSchema), async (c) => {
    const query = c.req.valid('query')
    const result = await feedService.list(query)
    return c.json(result)
  })

app.route('/feeds', feedRoutes)
```

## ORM: Drizzle

- スキーマは `packages/db/src/schema.ts` で一元管理
- 各サービスはスキーマをインポートして使用
- マイグレーションは `make migrate`

## 認証

- JWKS公開鍵を取得・キャッシュしてJWTをローカル検証
- `jose` ライブラリの `jwtVerify` を使用

## ログ

- `pino` で構造化JSON出力
- `console.log` は使用禁止

## テスト

- `vitest` を使用
- テストファイルは `src/**/*.test.ts`
