---
paths:
  - "apps/web/**/*.{ts,tsx}"
---

# フロントエンド規約 (TanStack Start)

## フレームワーク

- TanStack Start (フルスタック React)
- TanStack Router (型安全ルーティング)
- TanStack Query (サーバー状態管理)

## CSS: Tailwind CSS

- ユーティリティクラスを使用
- コンポーネントライブラリは不使用

## PWA

- `vite-plugin-pwa` で Service Worker 生成
- オフライン閲覧対応

## コンポーネント

- 関数コンポーネントのみ
- カスタムフックでロジックを分離
- Props は interface で定義

## Markdown表示

- `react-markdown` でブックマーク本文をレンダリング
