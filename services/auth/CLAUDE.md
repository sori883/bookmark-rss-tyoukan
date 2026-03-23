# auth サービス

Google OAuth + JWT発行 + JWKS公開の認証基盤。

## 技術スタック

- Hono + @hono/node-server
- Better Auth (Google OAuth, セッション管理)
- jose (JWT発行・JWKS)
- Drizzle ORM (packages/db)
- pino (ログ)

## ポート: 3000

## ディレクトリ構造

```
src/
├── index.ts           # Honoアプリ + サーバー起動
├── routes/
│   ├── oauth.ts       # Google OAuth (認可URL, コールバック)
│   ├── token.ts       # JWT発行, リフレッシュ, サービストークン
│   └── jwks.ts        # /.well-known/jwks.json
├── services/
│   ├── auth-service.ts
│   └── token-service.ts
├── middleware/
│   └── auth.ts        # 認証ミドルウェア
└── lib/
    ├── db.ts          # DB接続
    └── logger.ts      # pino設定
```

## エンドポイント

```
GET    /auth/google              OAuth開始
GET    /auth/google/callback     OAuthコールバック → JWT発行
POST   /auth/service-token       サービスJWT発行 (client_id + client_secret)
GET    /auth/.well-known/jwks.json  JWKS公開鍵
POST   /auth/refresh             トークンリフレッシュ
GET    /auth/me                  認証ユーザ情報
POST   /auth/logout              ログアウト
```

## 認証フロー

- Web: Google OAuth → セッション (httpOnly cookie)
- CLI/MCP: Google OAuth → Bearer JWT
- サービス間: client_id + client_secret → サービスJWT

## テーブル

- users, service_accounts (docs/03.データモデル.md 参照)

## テスト

```bash
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
```
