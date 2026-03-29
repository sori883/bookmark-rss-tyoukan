# web (PWAフロントエンド)

## 技術スタック

- TanStack Start (フルスタック React)
- TanStack Router (型安全ルーティング)
- TanStack Query (サーバー状態管理・キャッシュ)
- Tailwind CSS (ユーティリティファースト)
- react-markdown (ブックマーク本文表示)
- vite-plugin-pwa (Service Worker, オフライン対応)

## ポート: 5173

## API通信先

- feed サービス (http://localhost:3001) — フィード・記事・ブックマーク・設定
- notification サービス (http://localhost:3004) — 通知
- auth サービス (http://localhost:3000) — OAuthフローのみ

## 画面構成

- F5-1: ログイン (Google OAuth)
- F5-2: フィード管理 (登録/削除, OPMLインポート)
- F5-3: RSS記事一覧・閲覧 (ブックマークボタン付き)
- F5-4: ブックマーク管理
- F5-5: ブックマーク本文閲覧 (Markdown表示)
- F5-6: 設定 (Webhook URL)
- F5-7: レスポンシブ (PC/スマホ)
- F5-8: PWA (ホーム画面追加, オフライン)

## テスト

```bash
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
```
