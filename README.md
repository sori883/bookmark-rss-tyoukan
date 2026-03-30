# Bookmark RSS Tyoukan

RSSフィード購読・AI要約通知・ブックマーク本文抽出を統合したWebアプリケーション。

## アーキテクチャ概要

```
┌──────────────────────────────────────────────────────┐
│  クライアント                                           │
│  web (React PWA)  │  cli (Rust)  │  extension (Chrome) │
└────────────┬─────────────┬──────────────┬────────────┘
             │ REST + JWT  │              │
┌────────────▼─────────────▼──────────────▼────────────┐
│  API Gateway (Lambda Authorizer)                      │
├───────────┬───────────┬───────────┬──────────────────┤
│   auth    │   feed    │notification│       ai        │
│  (3000)   │  (3001)   │  (3004)   │     (3003)      │
│  TS/Hono  │  TS/Hono  │  TS/Hono  │  Python/FastAPI │
└─────┬─────┴─────┬─────┴─────┬─────┴────────┬────────┘
      │           │           │              │
      ▼           ▼           ▼              ▼
   PostgreSQL 17          Slack/Discord   AWS Bedrock
   (共有DB)               Webhook        Claude Haiku
```

- **auth**: Google OAuth, JWT発行, JWKS公開, デバイスコードフロー
- **feed**: フィードCRUD, RSS定期取得, 記事管理, ブックマーク(本文抽出・全文検索), ユーザ設定
- **ai**: 新着記事から注目記事を選定・要約し通知送信 (Strands Agents SDK → AgentCore)
- **notification**: Slack/Discord Webhook送信, 通知履歴管理
- **web**: フロントエンド PWA (TanStack Start + React 19 + Tailwind CSS)
- **cli**: ターミナルからフィード・ブックマーク操作 (Rust/clap)
- **extension**: Chrome拡張でワンクリックブックマーク (WXT)

## サービス一覧

| サービス | 言語 | ポート | 責務 | デプロイ先 |
|---------|------|-------|------|-----------|
| auth | TypeScript (Hono) | 3000 | 認証・JWT発行・JWKS | AWS Lambda |
| feed | TypeScript (Hono) | 3001 | フィード・記事・ブックマーク・設定 | AWS Lambda |
| ai | Python (FastAPI) | 3003 | AI記事選定・要約 | AgentCore Runtime |
| notification | TypeScript (Hono) | 3004 | Webhook通知・履歴 | AWS Lambda |
| web | TypeScript (TanStack Start) | 5173 | WebUI (PWA) | Vercel |
| cli | Rust (clap) | - | CLIクライアント | バイナリ配布 |
| extension | TypeScript (WXT) | - | Chrome拡張 | Chrome ウェブストア |

**共有パッケージ:**
| パッケージ | 言語 | 責務 |
|-----------|------|------|
| db | TypeScript (Drizzle ORM) | DBスキーマ・マイグレーション |
| mcp-server | Python (FastMCP) | MCP経由で記事・ブックマーク操作 |

## 前提条件

| ツール | バージョン | 備考 |
|--------|-----------|------|
| Node.js | v22 以上推奨 | TypeScript サービス全般 |
| pnpm | 10.32.1 | `packageManager` フィールドで指定。corepack 有効化推奨 |
| Docker / Docker Compose | 最新安定版 | PostgreSQL 17 コンテナ |
| Rust (cargo) | edition 2021 対応 (1.56+) | CLI ビルド用 |
| Python | >= 3.12 | AI サービス・MCPサーバー用 |
| uv | 最新安定版 | Python パッケージ管理 |

## セットアップ

### 1. 環境変数の設定

プロジェクトルートに `.env.test` を作成し、以下の値を自分の環境に合わせて設定する。
Makefile が自動で読み込むため、`source` は不要。

```env
# --- Database ---
DATABASE_URL=postgres://bookmark:bookmark@localhost:5432/bookmark_rss

# --- Auth (Google OAuth) ---
GOOGLE_CLIENT_ID=<Google Cloud Console で取得>
GOOGLE_CLIENT_SECRET=<Google Cloud Console で取得>
BETTER_AUTH_SECRET=<ランダム文字列 (openssl rand -base64 32)>
BETTER_AUTH_URL=http://localhost:3000
WEB_ORIGIN=http://localhost:5173

# --- AWS (Bedrock) ---
AWS_ACCESS_KEY_ID=<AWS アクセスキー>
AWS_SECRET_ACCESS_KEY=<AWS シークレットキー>
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-haiku-4-5-20251001-v1:0

# --- AI Service ---
AI_CLIENT_ID=ai-service
AI_CLIENT_SECRET=<ランダム文字列>

# --- Service URLs ---
AUTH_SERVICE_URL=http://localhost:3000
AUTH_JWKS_URL=http://localhost:3000/auth/.well-known/jwks.json
JWKS_URL=http://localhost:3000/auth/.well-known/jwks.json
FEED_SERVICE_URL=http://localhost:3001
NOTIFICATION_SERVICE_URL=http://localhost:3004

# --- Test ---
TEST_WEBHOOK_URL=<Discord or Slack の Webhook URL>
TEST_WEBHOOK_TYPE=discord
```

### 2. 一括セットアップ

```bash
make setup
```

以下を順番に実行する:
- Docker Compose で PostgreSQL 起動
- `pnpm install` + `uv sync` (依存インストール)
- DB マイグレーション
- シードデータ投入 (テストユーザー, JWKS鍵, サービスアカウント, Webhook設定)

### 3. Google OAuth の設定

Google Cloud Console でOAuthクライアントを作成し、以下を設定する:
- 承認済みリダイレクト URI: `http://localhost:3000/auth/callback/google`
- 承認済み JavaScript 生成元: `http://localhost:5173`, `http://localhost:3000`

## サービス起動

### バックグラウンド起動 (推奨)

```bash
make dev-bg
```

全サービスをバックグラウンドで起動し、ログは `logs/<service>.log` に出力される。

```bash
# ログ確認
tail -f logs/auth.log
tail -f logs/feed.log

# 全サービス停止
make dev-stop
```

### フォアグラウンド起動

```bash
make dev
```

全サービスを並列起動する。ログが混在するため `dev-bg` を推奨。

### 個別サービス起動

```bash
make auth-dev            # auth (Port 3000)
make feed-dev            # feed (Port 3001)
make ai-dev              # ai (Port 3003)
make notification-dev    # notification (Port 3004)
make web-dev             # web (Port 5173)
```

## テスト

### ユニットテスト (全サービス)

```bash
make test
```

個別に実行する場合:

```bash
cd services/auth && pnpm test
cd services/feed && pnpm test
cd services/notification && pnpm test
cd services/ai && uv run pytest
cd apps/web && pnpm test
cd apps/cli && cargo test
```

### Lint / 型チェック

```bash
make lint
make typecheck
```

### 結合テスト

全サービスが起動中かつシードデータ投入済みの状態で実行する。

```bash
cd tests/integration && pnpm test
```

## CDKデプロイ

### 前提: SSMパラメータの事前設定

初回のみ。`infra/.env.deploy.example` をコピーして値を埋め、スクリプトで登録する:

```bash
cp infra/.env.deploy.example infra/.env.deploy
# infra/.env.deploy を編集して実際の値を設定
bash infra/scripts/setup-ssm.sh dev
```

### デプロイ

```bash
cd infra
pnpm install
npx cdk diff          # 変更内容の確認
npx cdk deploy --all  # デプロイ実行
```

### デプロイされるリソース

- Lambda x4: auth, feed, notification, authorizer (JWT検証)
- API Gateway HTTP API (Lambda Authorizer付き)
- AgentCore Runtime (ai)
- EventBridge Scheduler (RSS定期取得 30分間隔, AIダイジェスト 毎日)

## 設計ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [01.要求定義](docs/01.要求定義.md) | 機能要求 |
| [02.技術設計](docs/02.技術設計.md) | アーキテクチャ・技術選定 |
| [03.データモデル](docs/03.データモデル.md) | テーブル定義 |
| [04.API型定義](docs/04.API型定義.md) | サービス間リクエスト/レスポンス型 |
| [05.ディレクトリ構成](docs/05.ディレクトリ構成.md) | プロジェクトのファイル構成 |

## トラブルシューティング

### PostgreSQL が起動しない

- Docker Desktop が起動しているか確認する。
- ポート 5432 が他のプロセスに使われていないか確認する: `lsof -i :5432`
- コンテナを完全リセットする: `make db-reset`

### auth サービスが起動しない

- `.env.test` の `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `BETTER_AUTH_SECRET` が設定されているか確認する。
- 環境変数がシェルに読み込まれているか確認する: `echo $GOOGLE_CLIENT_ID`

### 結合テストが失敗する

- 全サービス (auth, feed, notification) が起動しているか確認する。
- シードデータが投入済みか確認する: `pnpm seed-test`
- DB をリセットして再セットアップする: `make db-reset && make migrate && pnpm seed-test`

### JWKS エラー (JWT検証失敗)

- auth サービスが起動しているか確認する。
- JWKS エンドポイントにアクセスできるか確認する: `curl http://localhost:3000/auth/.well-known/jwks.json`
- JWKS 鍵ペアを再生成する: `pnpm seed-test`

### feed / notification が認証エラーになる

- auth の JWKS エンドポイントが応答しているか確認する。
- 各サービスの `JWKS_URL` が `http://localhost:3000/auth/.well-known/jwks.json` を指しているか確認する。
