# feed サービス

フィードCRUD、RSS記事管理、ブックマーク管理（本文抽出・全文検索）を担当するデータ層。

## 技術スタック

- Hono + @hono/node-server
- Drizzle ORM (packages/db)
- rss-parser (RSS解析)
- @mozilla/readability + turndown (HTML→Markdown)
- jose (JWKS JWT検証)
- zod, pino

## ポート: 3001

## ディレクトリ構造

```
src/
├── index.ts
├── routes/
│   ├── feeds.ts       # フィードCRUD + フェッチ
│   ├── articles.ts    # 記事CRUD
│   └── bookmarks.ts   # ブックマークCRUD + 全文検索
├── services/
│   ├── feed-service.ts
│   ├── article-service.ts
│   ├── bookmark-service.ts
│   └── rss-fetcher.ts     # RSS取得・パース
├── middleware/
│   └── auth.ts            # ユーザーJWT + サービスJWT両対応
└── lib/
    ├── db.ts
    ├── readability.ts     # HTML→Markdown変換
    └── logger.ts
```

## エンドポイント (docs/04.API型定義.md 参照)

```
POST/GET/DELETE  /feeds/*        フィードCRUD
POST             /feeds/fetch    RSS定期取得
POST/GET/PATCH/DELETE /articles/* 記事CRUD
POST/GET/DELETE  /bookmarks/*    ブックマークCRUD
GET              /bookmarks/search 全文検索
```

## ブックマーク登録フロー

1. article_id or URL を受け取る
2. URLから記事本文をHTTP取得
3. @mozilla/readability で本文抽出
4. turndown でMarkdownに変換
5. bookmarks テーブルに保存 (search_vector も自動更新)

## テーブル

- feeds, articles, bookmarks, jobs (docs/03.データモデル.md 参照)
