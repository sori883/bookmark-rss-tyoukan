# 開発ワークフロー（CRITICAL）

全ての開発作業は `todos` CLI でタスク管理する。コードに触れる前にタスク登録する。

## プロジェクト構成

サービスごとにプロジェクトを分ける:

| project 名 | 対象 |
|---|---|
| auth | services/auth |
| feed | services/feed |
| ai | services/ai |
| notification | services/notification |
| web | apps/web |
| cli | apps/cli |
| db | packages/db |
| infra | infra/ |
| openapi | openapi/ |

## タスク構造

親タスク (`--label <category> --project <service>`) の下にサブタスクを作る:

1. 設計・計画
2. テスト設計
3. 実装: xxx（実装単位ごとに分割）
4. テスト実装・実行
5. 検証・レビュー

label はカテゴリ (`feature`, `bug`, `improvement`, `refactor`, `documentation`, `chore`)。

## フェーズとゲート条件

| Phase | 内容 | 完了条件 |
|-------|------|---------|
| 0. タスク登録 | 親タスク + サブタスク作成 | `todos list -P <project>` で確認 |
| 1. 設計・計画 | 要件整理、設計方針、リスク評価 | **ユーザー承認** |
| 2. テスト設計 | テストケース定義 → content に記録 | **ユーザー承認** |
| 3. 実装 | 1サブタスクずつ in_progress → done | ビルドパス |
| 4. テスト | テストコード作成・実行 | チェックが全パス |
| 5. 完了 | 全サブタスク done → 親を done | — |

## 厳守ルール

- フェーズ順を飛ばさない
- 承認なしに次フェーズへ進まない
- 実装サブタスクは1つずつ（並列 `in_progress` 禁止）
- サブタスク完了時は `todos status <id> done`
- 設計変更が必要になったらユーザーに報告して Phase 1 に戻る

## 検証コマンド（サービスに応じて）

```bash
# TypeScript サービス
cd services/<name> && pnpm lint && pnpm typecheck && pnpm test

# Python サービス
cd services/ai && uv run ruff check . && uv run pyright . && uv run pytest

# Rust CLI
cd apps/cli && cargo fmt --check && cargo clippy -- -D warnings && cargo test

# 全サービス一括
make lint && make typecheck && make test
```

## Git / GitHub ワークフロー（gh CLI）

```bash
# ブランチ作成
git checkout -b feature/<service>-<feature>

# コミット
git add <files>
git commit -m "feat(<service>): 説明"

# PR作成
gh pr create --title "feat(<service>): 説明" --body "..."

# PR確認
gh pr list
gh pr view <number>
```

コミットメッセージは Conventional Commits 形式:
- `feat(<service>):` 新機能
- `fix(<service>):` バグ修正
- `refactor(<service>):` リファクタ
- `docs:` ドキュメント
- `chore:` 雑務

## 例外（タスク登録を省略してよい）

- 1行の typo/コメント修正
- ユーザーが明示的にスキップを指示
