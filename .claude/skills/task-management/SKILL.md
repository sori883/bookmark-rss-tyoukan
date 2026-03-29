---
name: task-management
description: todos CLI を使ったサービス別タスク管理の実行手順。フェーズごとのコマンドパターンとテンプレートを提供する。
---

# タスク管理スキル

**ワークフロールール: `.claude/rules/dev-workflow.md` が正。本スキルは実行手順の補足。**
**コマンド仕様: `todos --help` / `todos <cmd> --help` が正。**

## サービス別プロジェクト

このモノレポではサービスごとに `--project` を分ける:

```
auth, feed, ai, notification, web, cli, db, infra, openapi
```

## タスク作成テンプレート

```bash
# 1. 親タスク作成（サービス名をprojectに指定）
todos add "機能名: 概要" --label <category> --project <service> --created-by ai
# label: feature | bug | improvement | refactor | documentation | chore
# service: auth | feed | ai | notification | web | cli | db

# 2. 親タスク ID 取得（前方一致 prefix を使用）
todos list -P <service> --format json

# 3. サブタスク一括作成（Phase 順）
todos add "設計・計画" --parent <PREFIX> --created-by ai
todos add "テスト設計" --parent <PREFIX> --created-by ai
todos add "実装: xxx" --parent <PREFIX> --created-by ai   # 実装単位ごとに分割
todos add "テスト実装・実行" --parent <PREFIX> --created-by ai
todos add "検証・レビュー" --parent <PREFIX> --created-by ai
```

## フェーズ実行パターン

各フェーズ開始時に `todos status <ID> in_progress`、完了時に `todos status <ID> done`。

### Phase 1-2: 設計・テスト設計（承認ゲート）

```bash
# テストケースを content に記録
todos edit <ID> --content "1. 正常系: ... 2. 異常系: ... 3. 境界値: ..."
```

ユーザーに設計/テストケースを提示 → **承認を得てから** done にする。

### Phase 3: 実装（1サブタスクずつ）

```bash
todos status <ID> in_progress   # 着手
# コード実装 → ビルドパス
todos status <ID> done          # 完了してから次へ
```

### Phase 4: テスト・検証

サービスに応じたコマンドを実行:

```bash
# TypeScript サービス（auth, feed, notification）
cd services/<name> && pnpm lint && pnpm typecheck && pnpm test

# Python サービス（ai）
cd services/ai && uv run ruff check . && uv run pyright . && uv run pytest

# Rust（cli）
cd apps/cli && cargo fmt --check && cargo clippy -- -D warnings && cargo test

# フロントエンド（web）
cd apps/web && pnpm lint && pnpm typecheck && pnpm test
```

### Phase 5: 完了

```bash
# 全サブタスク done 確認後
todos status <PARENT_ID> done
```

## 進捗確認

```bash
todos list -P <service>              # サービス内タスク一覧
todos list -P <service> --all        # done/cancelled 含む
todos show <ID>                      # 個別タスク詳細
todos stats                          # 全体統計
```

## Git / GitHub（gh CLI）

```bash
# フィーチャーブランチ作成
git checkout -b feature/<service>-<feature>

# コミット（Conventional Commits）
git add <files>
git commit -m "feat(<service>): 説明"

# PR作成
gh pr create --title "feat(<service>): 説明" --body "$(cat <<'EOF'
## Summary
- ...

## Test plan
- [ ] ...
EOF
)"

# PR一覧・詳細
gh pr list
gh pr view <number>
gh pr merge <number>
```
