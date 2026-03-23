---
paths:
  - "apps/cli/**/*.rs"
---

# Rust CLI 規約

## フレームワーク: clap (derive)

- サブコマンドは `#[derive(clap::Subcommand)]` で定義
- 引数は型安全に

## HTTPクライアント: reqwest

- 非同期 (`tokio`)
- JSON シリアライズ/デシリアライズは `serde`

## エラーハンドリング

- `anyhow::Result` または独自エラー型
- `panic!` は使用禁止（`expect` も最小限に）

## コードスタイル

- `cargo fmt` でフォーマット
- `cargo clippy -- -D warnings` で lint
- `RUSTFLAGS="-D warnings" cargo test` でテスト

## ログ

- `tracing` + `tracing-subscriber`
- 構造化JSON出力
