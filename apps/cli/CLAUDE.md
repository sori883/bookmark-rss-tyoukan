# cli (Rust CLIクライアント)

## 技術スタック

- clap (derive マクロ, サブコマンド, 補完生成)
- reqwest (非同期HTTP)
- serde + serde_json (JSON)
- tokio (非同期ランタイム)
- tracing + tracing-subscriber (構造化ログ)

## API通信先

- bff サービス (http://localhost:3010)
- auth サービス (http://localhost:3000) — OAuthフロー

## コマンド体系

```
bookmark-rss login                       OAuthログイン → JWTをローカル保存
bookmark-rss feed list                   フィード一覧
bookmark-rss feed add <url>              フィード追加
bookmark-rss feed remove <id>            フィード削除
bookmark-rss feed import <opml-file>     OPMLインポート
bookmark-rss article list [--unread]     記事一覧
bookmark-rss article read <id>           記事詳細
bookmark-rss bookmark list               ブックマーク一覧
bookmark-rss bookmark add <target>       ブックマーク追加
bookmark-rss bookmark remove <id>        ブックマーク削除
bookmark-rss bookmark read <id>          本文表示 (Markdown)
bookmark-rss bookmark search <keyword>   全文検索
```

## テスト

```bash
cargo test
cargo fmt --check
cargo clippy --all-targets -- -D warnings
```
