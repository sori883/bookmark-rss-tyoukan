# mcp-server (MCP Server)

MCP経由で記事検索・ブックマーク操作を提供する。ローカル実行 (stdio)。

## 技術スタック

- mcp (FastMCP) — Python MCP標準SDK
- httpx (HTTPクライアント)
- structlog (ログ)
- Pydantic (バリデーション)
- uv (パッケージ管理)

## API通信先

- feed サービス (http://localhost:3001) — フィード・記事・ブックマーク

## ツール定義

```
list_feeds()                         フィード一覧
list_articles(feed_id?: str)         記事一覧
get_article(id: str)                 記事詳細
list_bookmarks()                     ブックマーク一覧
get_bookmark(id: str)                ブックマーク詳細 (本文あり)
add_bookmark(url: str)               URL指定でブックマーク追加
remove_bookmark(id: str)             ブックマーク削除
search_bookmarks(query: str)         全文検索
```

## 認証

- 起動時にJWTを環境変数 or config から読み込み
- feed へのリクエストに Bearer JWT を付与

## テスト

```bash
uv run pytest
uv run ruff check .
```
