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

## サービス起動

Makefile が `.env.test` を自動で読み込むため、手動での `source` は不要。

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
