# Bookmark RSS Tyoukan

RSSフィード購読・AI要約通知・ブックマーク本文抽出を統合したWebアプリケーション。

## 前提条件

| ツール | バージョン | 備考 |
|--------|-----------|------|
| Node.js | v22 以上推奨 | TypeScript サービス全般 |
| pnpm | 10.32.1 | `packageManager` フィールドで指定。corepack 有効化推奨 |
| Docker / Docker Compose | 最新安定版 | PostgreSQL 17 コンテナ |
| Rust (cargo) | edition 2021 対応 (1.56+) | CLI ビルド用 |
| Python | >= 3.12 | AI サービス用 |
| uv | 最新安定版 | Python パッケージ管理 |

## セットアップ

### 1. 依存インストール

```bash
# corepack を有効化して pnpm のバージョンを合わせる
corepack enable

# Node.js 依存
pnpm install

# AI サービスの Python 依存
cd services/ai && uv sync
```

### 2. 環境変数の設定

プロジェクトルートの `.env.test` をテンプレートとして環境変数を設定する。
以下の値は自分の環境に合わせて書き換えること。

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

### 3. PostgreSQL 起動

```bash
make db
```

Docker Compose で PostgreSQL 17 コンテナが起動する (ポート 5432)。

### 4. DBマイグレーション

```bash
make migrate
```

`packages/db` の Drizzle マイグレーションが実行される。

### 5. シードデータ投入

```bash
pnpm seed-test
```

テストユーザー、サービスアカウント (AI)、JWKS 鍵ペア、Webhook 設定がDBに登録される。
`.env.test` の `AI_CLIENT_ID` / `AI_CLIENT_SECRET` / `TEST_WEBHOOK_URL` を参照するため、先に環境変数を設定しておくこと。

## サービス起動

### 環境変数の読み込み

各サービスは `.env.test` の環境変数を必要とする。起動前にシェルに読み込む。

```bash
set -a && source .env.test && set +a
```

### 一括起動

```bash
make dev
```

auth, feed, ai, notification, web を並列起動する。ログが混在するため、個別起動を推奨。

### 個別起動 (推奨)

各ターミナルで環境変数を読み込んでから実行する。

```bash
# ターミナル1: auth (port 3000)
cd services/auth && pnpm dev

# ターミナル2: feed (port 3001)
cd services/feed && pnpm dev

# ターミナル3: ai (port 3003)
cd services/ai && uv run uvicorn src.main:app --reload --port 3003

# ターミナル4: notification (port 3004)
cd services/notification && pnpm dev

# ターミナル5: web (port 5173)
cd apps/web && pnpm dev
```

### ポート一覧

| サービス | ポート |
|---------|-------|
| auth | 3000 |
| feed | 3001 |
| ai | 3003 |
| notification | 3004 |
| web (Vite) | 5173 |

## 手動試験シナリオ

### a. Google OAuth ログイン

1. Google Cloud Console でOAuthクライアントを作成し、以下を設定する:
   - 承認済みリダイレクト URI: `http://localhost:3000/auth/callback/google`
   - 承認済み JavaScript 生成元: `http://localhost:5173`, `http://localhost:3000`
2. 取得した `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` を `.env.test` に設定する。
3. ブラウザで http://localhost:5173 にアクセスし、ログインボタンをクリック。
4. Google アカウントで認証後、JWT が発行されアプリにリダイレクトされる。

### b. フィード登録・記事閲覧

1. ログイン後、Web UI からフィード URL (例: `https://zenn.dev/feed`) を登録する。
2. 記事一覧が表示されることを確認する。
3. 記事をクリックして詳細を表示する (自動既読)。

### c. ブックマーク登録・検索

1. 記事一覧からブックマークボタンで追加する。
2. URL 指定でブックマークを追加する。
3. ブックマーク全文検索でキーワード検索を試す。

### d. 設定変更

1. 設定画面で Webhook URL (Discord or Slack) を入力する。
2. Webhook Type を `discord` または `slack` に変更する。

### e. CLI 操作

```bash
# ビルド
cd apps/cli && cargo build

# ログイン (ブラウザが開く)
./target/debug/bookmark-rss-cli login

# フィード一覧
./target/debug/bookmark-rss-cli feed list

# フィード追加
./target/debug/bookmark-rss-cli feed add https://zenn.dev/feed

# 記事一覧
./target/debug/bookmark-rss-cli article list --unread

# ブックマーク一覧
./target/debug/bookmark-rss-cli bookmark list

# ブックマーク検索
./target/debug/bookmark-rss-cli bookmark search "キーワード"
```

### f. 通知確認

Webhook 設定が完了した状態で、ai サービスの POST /digest を手動呼び出しする。

```bash
curl -X POST http://localhost:3003/digest \
  -H "Content-Type: application/json" \
  -d '{}'
```

Discord / Slack にAI要約通知が届くことを確認する。

## 自動テスト実行

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

### CDK Synth

```bash
cd infra && npx cdk synth
```

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
