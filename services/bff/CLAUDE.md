# bff サービス

ドメインロジック層。Web/CLI/MCPの共通エントリポイント。下流サービス(feed, notification)をオーケストレーション。

## 技術スタック

- Hono + @hono/node-server
- jose (JWKS検証)
- zod (バリデーション)
- pino (ログ)

## ポート: 3010

## ディレクトリ構造

```
src/
├── index.ts           # Honoアプリ + サーバー起動
├── routes/
│   ├── feeds.ts       # /feeds エンドポイント
│   ├── articles.ts    # /articles エンドポイント
│   ├── bookmarks.ts   # /bookmarks エンドポイント
│   ├── notifications.ts # /notifications エンドポイント
│   └── settings.ts    # /settings エンドポイント
├── services/
│   ├── feed-client.ts      # feed サービスへのHTTPクライアント
│   └── notification-client.ts # notification サービスへのHTTPクライアント
├── middleware/
│   └── auth.ts        # JWKS JWT検証
└── lib/
    ├── db.ts          # DB接続 (settings用)
    └── logger.ts
```

## エンドポイント (docs/04.API型定義.md 参照)

```
GET/POST/DELETE  /feeds/*        → feed サービスに委譲
GET/PATCH        /articles/*     → feed サービスに委譲
GET/POST/DELETE  /bookmarks/*    → feed サービスに委譲
GET/PATCH        /notifications/* → notification サービスに委譲
GET/PUT          /settings       → DB直接
```

## 注意点

- bff はDBに直接アクセスするのは settings のみ
- それ以外は全て下流サービスにHTTPで委譲
- ユーザーJWTをそのまま下流に転送する
