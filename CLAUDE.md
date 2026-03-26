# Bookmark RSS Tyoukan

RSSフィード購読・AI要約通知・ブックマーク本文抽出を統合したWebアプリケーション。

## 設計ドキュメント

詳細は `docs/` を参照:
- `01.要求定義.md` — 機能要求
- `02.技術設計.md` — アーキテクチャ・技術選定
- `03.データモデル.md` — テーブル定義
- `04.API型定義.md` — サービス間リクエスト/レスポンス型
- `05.開発の進め方.md` — Phase別開発計画

## 絶対ルール（CRITICAL）

- **docs/ の仕様は必須準拠**: `docs/` 配下の設計ドキュメント（データモデル、API型定義、技術設計等）は正式な仕様である。実装は仕様に完全準拠すること。仕様と実装に乖離がある場合、仕様側を変更する必要があるなら**先にドキュメントを更新してからコードを書く**。
- **`/tmp` 使用禁止**: 一時ファイルやスクリプトを `/tmp` に置かない。全ての作業ファイルはこのプロジェクトディレクトリ内に限定する。
- **作業ディレクトリは `./` 配下に限定**: ファイルの読み書き・コマンド実行は原則プロジェクトルート配下で行う。**例外: git worktree の作成**（`git worktree add ../proj-xxx feature/xxx`）は許可。ただし worktree 内のファイル操作は行わない。

## git worktree 並行開発

main エージェントが `git worktree add` で worktree を作成し、ユーザーが各 worktree で個別に AI エージェントを立ち上げて実装する。main エージェントはオーケストレーション（設計・計画・タスク管理・マージ指示）に徹し、worktree 内のファイル操作は行わない。

openapi/ と packages/db/ は契約。変更時は main で確定させてから各 worktree に反映する。

## CDKデプロイ手順

### 前提: SSMパラメータの事前設定

初回のみ、AWS SSM Parameter Store に以下を手動設定する:

```bash
aws ssm put-parameter --name "/bookmark-rss/dev/database-url" --value "postgresql://..." --type String
aws ssm put-parameter --name "/bookmark-rss/dev/google-client-id" --value "xxx" --type String
aws ssm put-parameter --name "/bookmark-rss/dev/google-client-secret" --value "xxx" --type String
aws ssm put-parameter --name "/bookmark-rss/dev/better-auth-secret" --value "xxx" --type String
aws ssm put-parameter --name "/bookmark-rss/dev/ai-client-id" --value "xxx" --type String
aws ssm put-parameter --name "/bookmark-rss/dev/ai-client-secret" --value "xxx" --type String
```

### デプロイ

```bash
cd infra
pnpm install
npx cdk diff          # 変更内容の確認
npx cdk deploy --all  # デプロイ実行
```

### デプロイされるリソース

- Lambda x4: auth, feed, notification, **authorizer**（JWT検証）
- API Gateway HTTP API（Lambda Authorizer付き）
- AgentCore Runtime（ai）
- EventBridge Scheduler（RSS定期取得, AIダイジェスト）
