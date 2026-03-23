# notification サービス

Webhook送信(Slack/Discord)と通知履歴管理を担当する処理層。

## 技術スタック

- Hono + @hono/node-server
- Drizzle ORM (packages/db)
- jose (JWKS JWT検証)
- zod, pino

## ポート: 3004

## ディレクトリ構造

```
src/
├── index.ts
├── routes/
│   └── notifications.ts   # POST /notify, GET /notifications, PATCH /:id
├── services/
│   ├── notification-service.ts
│   └── webhook-sender.ts     # Slack/Discord Webhook送信
├── middleware/
│   └── auth.ts               # ユーザーJWT + サービスJWT両対応
└── lib/
    ├── db.ts
    └── logger.ts
```

## エンドポイント

```
POST  /notify              通知送信 (Webhook + DB保存)
GET   /notifications       通知履歴一覧
PATCH /notifications/:id   通知既読
```

## Webhook送信

- settings テーブルからユーザーの webhook_url と webhook_type を取得
- slack: Slack Incoming Webhook 形式
- discord: Discord Webhook 形式

## テーブル

- notifications (docs/03.データモデル.md 参照)
