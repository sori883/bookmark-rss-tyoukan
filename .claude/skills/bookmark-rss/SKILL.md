---
name: bookmark-rss
description: bookmark-rss CLIを使ってブックマーク検索、記事・フィード一覧、ブックマーク追加・削除、本文Markdown取得を行う。ユーザーが保存済み記事の検索、ブックマーク操作、RSSフィード確認、ページの本文取得を依頼した時にトリガーする。
user-invocable: true
---

# bookmark-rss CLI Skill

bookmark-rss CLIを使ってRSSフィード・記事・ブックマークを操作する。
CLIはAI利用を意識して設計されており、出力はプレーンテキスト（TSV/Markdown）で機械可読性が高い。

## 前提: 認証

CLIはJWTトークンが必要。未ログインの場合は以下のエラーが出る:

```
Not logged in. Please run: bookmark-rss login
```

このエラーが出たら、ユーザーに `bookmark-rss login` の実行を促す。ログインはブラウザ操作（Device Code Flow）が必要なため、AIが代行することはできない。

## コマンド一覧

コマンドがわからなくなったら `bookmark-rss-cli help` を実行する。全コマンドがフラットに表示される。

```bash
bookmark-rss-cli help
```

## 典型的なワークフロー

### ブックマークを検索して中身を読む

```bash
# 1. キーワードで全文検索
bookmark-rss-cli bookmark search "Claude"
# → TSVでID一覧が返る

# 2. 該当IDの本文をMarkdownで取得
bookmark-rss-cli bookmark read <id>
# → Markdown本文が返る。要約・比較・分析にそのまま使える
```

### URLから直接ブックマークする

```bash
# URLを渡すとWebページの本文を自動抽出してMarkdownで保存
bookmark-rss-cli bookmark add https://example.com/article
```
