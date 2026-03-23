# ai サービス

定期ジョブで新着RSS記事を選定・要約し、notificationサービス経由で通知を送信する。

## 技術スタック

- FastAPI (非同期)
- Strands Agents SDK + Bedrock AgentCore
- Amazon Bedrock Claude Haiku (要約モデル)
- httpx (HTTPクライアント)
- structlog (ログ)
- Pydantic (バリデーション)
- uv (パッケージ管理)

## ポート: 3003

## ディレクトリ構造

```
src/
├── __init__.py
├── main.py            # FastAPIアプリ
├── routes/
│   └── digest.py      # POST /digest
├── services/
│   ├── article_selector.py  # 記事選定ロジック
│   └── summarizer.py        # 要約生成
├── clients/
│   ├── feed_client.py       # feed サービスHTTPクライアント
│   └── notification_client.py # notification サービスHTTPクライアント
└── lib/
    ├── auth.py        # サービスJWT取得
    └── logger.py      # structlog設定
```

## エンドポイント

```
POST /digest    定期実行トリガー
GET  /health    ヘルスチェック
```

## 処理フロー (POST /digest)

1. authからサービスJWTを取得
2. feedサービスから新着記事一覧を取得
3. Claude Haikuで注目記事を選定・要約生成
4. notificationサービスに要約+URLを送信

## デプロイ

- AgentCore Runtime (サーバーレス)
- EventBridge Scheduler で毎朝9時にトリガー

## テスト

```bash
uv run pytest              # テスト
uv run ruff check .        # lint
uv run pyright .           # 型チェック
```
