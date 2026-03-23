# Bookmark RSS Tyoukan

RSSフィード購読・AI要約通知・ブックマーク本文抽出を統合したWebアプリケーション。

## アーキテクチャ

マイクロサービス構成のモノレポ。git worktree で並行開発する。

| サービス | 言語 | ポート | 責務 |
|---|---|---|---|
| auth | TypeScript (Hono) | 3000 | Google OAuth, JWT発行, JWKS公開 |
| bff | TypeScript (Hono) | 3010 | ドメインロジック、下流オーケストレーション |
| feed | TypeScript (Hono) | 3001 | フィードCRUD, RSS取得, ブックマーク管理 |
| ai | Python (FastAPI) | 3003 | 記事選定・要約 (Strands Agents SDK) |
| notification | TypeScript (Hono) | 3004 | Webhook送信, 通知履歴 |
| web | TypeScript (TanStack Start) | 5173 | PWAフロントエンド |
| cli | Rust (clap) | - | CLIクライアント |
| mcp-server | Python (FastMCP) | stdio | MCPサーバー |

## ディレクトリ構成

```
services/          # バックエンドサービス
  auth/ bff/ feed/ notification/   # TypeScript (Hono)
  ai/                              # Python (FastAPI)
apps/              # クライアント
  web/             # TanStack Start (PWA)
  cli/             # Rust CLI
packages/          # 共有パッケージ
  db/              # Drizzle スキーマ・マイグレーション
  mcp-server/      # MCP Server (Python)
openapi/           # OpenAPI仕様（サービス間契約）
infra/             # AWS CDK
docs/              # 設計ドキュメント
```

## コマンド

```bash
make db             # PostgreSQL起動
make dev            # 全サービス起動
make test           # 全テスト
make lint           # 全lint
make typecheck      # 全型チェック
make migrate        # DBマイグレーション
make feed-dev       # feedのみ起動
make auth-test      # authのみテスト
```

## サービス間認証

各サービスは auth の JWKS エンドポイント (`/.well-known/jwks.json`) から公開鍵を取得・キャッシュし、JWT をローカル検証する。

## 技術スタック

- **TypeScript**: Hono, Drizzle ORM, Better Auth, zod, pino
- **Python**: FastAPI, Strands Agents SDK, uv, structlog
- **Rust**: clap, reqwest, serde, tracing
- **フロントエンド**: TanStack Start, TanStack Query, Tailwind CSS
- **DB**: PostgreSQL (ローカル: Docker, 本番: Supabase)
- **IaC**: AWS CDK

## 設計ドキュメント

詳細は `docs/` を参照:
- `01.要求定義.md` — 機能要求
- `02.技術設計.md` — アーキテクチャ・技術選定
- `03.データモデル.md` — テーブル定義
- `04.API型定義.md` — サービス間リクエスト/レスポンス型
- `05.開発の進め方.md` — Phase別開発計画

## git worktree 並行開発

```bash
git worktree add ../proj-feed  feature/feed
git worktree add ../proj-notif feature/notification
```

openapi/ と packages/db/ は契約。変更時は main で確定させてから各 worktree に反映する。
