# db (共有DBスキーマ)

Drizzle ORM でスキーマ定義・マイグレーションを一元管理する。全TSサービスがこのパッケージをインポートする。

## 技術スタック

- Drizzle ORM
- drizzle-kit (マイグレーション)
- postgres (PostgreSQLドライバ)

## テーブル (docs/03.データモデル.md 参照)

- users
- feeds
- articles
- bookmarks (search_vector: tsvector)
- settings
- service_accounts
- notifications
- jobs

## コマンド

```bash
pnpm generate   # マイグレーション生成
pnpm migrate    # マイグレーション実行
pnpm studio     # Drizzle Studio (GUI)
pnpm push       # スキーマを直接プッシュ
```

## 注意

- スキーマ変更は Phase 0 で確定させる
- 変更後は main にマージしてから各 worktree に反映
- 各サービスは `@bookmark-rss/db` としてインポート
