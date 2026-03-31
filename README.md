# Bookmark RSS Tyoukan

RSSフィード購読・AI要約通知・ブックマーク本文抽出を統合したWebアプリケーション。Web UI・CLIを備え、人間とAIの両方が操作できるシステムです。

## アーキテクチャ概要

```mermaid
graph TD
    subgraph Clients["クライアント"]
        web["web<br/>React PWA"]
        cli["cli<br/>Rust"]
        ext["extension<br/>Chrome"]
    end

    web -->|OAuth フロー| auth
    cli -->|デバイスコードフロー| auth
    ext -->|デバイスコードフロー| auth

    web -->|REST + JWT| gw
    cli -->|REST + JWT| gw
    ext -->|REST + JWT| gw

    subgraph AWS["AWS"]
        gw["API Gateway<br/>Lambda Authorizer"]
        gw -->|REST| auth["auth<br/>TS/Hono · Lambda"]
        gw -->|REST| feed["feed<br/>TS/Hono · Lambda"]
        gw -->|REST| notification["notification<br/>TS/Hono · Lambda"]
        ai["ai<br/>Python/FastAPI · AgentCore"]
    end

    auth -.->|JWKS 公開鍵| feed
    auth -.->|JWKS 公開鍵| notification
    auth -.->|JWKS 公開鍵| ai

    ai -->|REST| feed
    ai -->|REST| notification

    cron["EventBridge Scheduler"]
    cron -->|30分間隔| feed
    cron -->|毎日| ai

    auth --> db[("PostgreSQL 17")]
    feed --> db
    notification --> db

    ai -->|Claude Haiku| bedrock["AWS Bedrock"]
    notification -->|Webhook| slack["Slack / Discord"]
```

- **auth**: 認証・JWT発行・JWKS公開
- **feed**: フィードCRUD, RSS定期取得, 記事管理, ブックマーク, ユーザ設定
- **ai**: 新着記事から注目記事を選定・要約し通知送信
- **notification**: Webhook送信, 通知履歴管理
- **web**: フロントエンド PWA
- **cli**: ターミナルからフィード・ブックマーク操作
- **extension**: Chrome拡張でワンクリックブックマーク

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


## 前提条件

| ツール | バージョン | 備考 |
|--------|-----------|------|
| Node.js | v22 以上推奨 | TypeScript サービス全般 |
| pnpm | 10.32.1 | `packageManager` フィールドで指定。corepack 有効化推奨 |
| Docker / Docker Compose | 最新安定版 | PostgreSQL 17 コンテナ |
| Rust (cargo) | edition 2021 対応 (1.56+) | CLI ビルド用 |
| Python | >= 3.12 | AI サービス用 |
| uv | 最新安定版 | Python パッケージ管理 |

## ローカルセットアップ

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

### サービス起動

#### バックグラウンド起動 (推奨)

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

#### フォアグラウンド起動

```bash
make dev
```

全サービスを並列起動する。ログが混在するため `dev-bg` を推奨。

#### 個別サービス起動

```bash
make auth-dev            # auth (Port 3000)
make feed-dev            # feed (Port 3001)
make ai-dev              # ai (Port 3003)
make notification-dev    # notification (Port 3004)
make web-dev             # web (Port 5173)
```

### CLI (Rust) のセットアップ

#### ビルド

```bash
cd apps/cli
cargo build --release
```

ビルド成果物は `apps/cli/target/release/bookmark-rss-cli` に出力される。

#### 設定

設定は **環境変数 > 設定ファイル > デフォルト** の優先順で読み込まれる。

| 環境変数 | 設定ファイルのキー | デフォルト値 | 用途 |
|---------|------------------|-------------|------|
| `BOOKMARK_RSS_API_URL` | `api_url` | `http://localhost:3001` | feed サービスの URL |
| `BOOKMARK_RSS_AUTH_URL` | `auth_url` | `http://localhost:3000` | auth サービスの URL |
| `BOOKMARK_RSS_CONFIG_DIR` | - | `~/.config/bookmark-rss` (macOS: `~/Library/Application Support/bookmark-rss`) | 設定ディレクトリ |

設定ファイルで永続化する場合:

```bash
bookmark-rss-cli config set --api-url http://localhost:3001 --auth-url http://localhost:3000
bookmark-rss-cli config show   # 現在の設定を確認
```

#### ログイン

デバイスコードフローで認証する。ブラウザが自動で開く。

```bash
bookmark-rss-cli login
```

トークンは `<config_dir>/token.json` に保存される。

#### 主要コマンド

```bash
bookmark-rss-cli feed list                   # フィード一覧
bookmark-rss-cli feed add <url>              # フィード追加
bookmark-rss-cli feed remove <id>            # フィード削除
bookmark-rss-cli feed import <opml-file>     # OPMLインポート
bookmark-rss-cli article list [--unread]     # 記事一覧
bookmark-rss-cli article read <id>           # 記事詳細
bookmark-rss-cli bookmark list               # ブックマーク一覧
bookmark-rss-cli bookmark add <target>       # ブックマーク追加
bookmark-rss-cli bookmark remove <id>        # ブックマーク削除
bookmark-rss-cli bookmark read <id>          # 本文表示 (Markdown)
bookmark-rss-cli bookmark search <keyword>   # 全文検索
```

### テスト

#### ユニットテスト (全サービス)

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

#### Lint / 型チェック

```bash
make lint
make typecheck
```

#### 結合テスト

全サービスが起動中かつシードデータ投入済みの状態で実行する。

```bash
cd tests/integration && pnpm test
```

## デプロイメント

本番環境ではデータベースに Supabase (マネージド PostgreSQL) を使用する。

### フロントエンド (Vercel)

Vercel に以下の環境変数を設定する。値は CDK デプロイ後に確定する API Gateway の URL を指定する。

| 環境変数 | 用途 |
|---------|------|
| `VITE_AUTH_BASE_URL` | 認証サービスの URL |
| `VITE_API_BASE_URL` | feed サービスの URL |
| `VITE_NOTIFICATION_BASE_URL` | notification サービスの URL |

### データベース (Supabase)

Supabase プロジェクトを作成し、接続文字列を取得する。`DATABASE_URL` は SSMパラメータおよび Vercel の環境変数で設定する。

### バックエンド (AWS CDK)

#### SSMパラメータの設定（初回のみ）

`infra/.env.deploy.example` をコピーして値を埋め、スクリプトで登録する:

```bash
cp infra/.env.deploy.example infra/.env.deploy
# infra/.env.deploy を編集して実際の値を設定
bash infra/scripts/setup-ssm.sh dev
```

#### CDKデプロイ

```bash
cd infra
pnpm install
npx cdk diff          # 変更内容の確認
npx cdk deploy --all  # デプロイ実行
```

#### デプロイされるリソース

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

