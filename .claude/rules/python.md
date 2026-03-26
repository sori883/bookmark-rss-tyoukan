---
paths:
  - "services/ai/**/*.py"
---

# Python サービス規約

## パッケージ管理: uv

- `uv sync` で依存インストール
- `uv run` でスクリプト実行
- `uv add` で依存追加

## ai サービス: FastAPI

- 非同期ハンドラ (`async def`)
- Pydantic モデルでバリデーション
- Dependency Injection は `Depends` を使用

```python
from fastapi import FastAPI, Depends
from pydantic import BaseModel

class DigestRequest(BaseModel):
    since: str | None = None

@app.post("/digest")
async def digest(req: DigestRequest):
    ...
```

## コードスタイル

- フォーマッタ/リンター: `ruff`
- 型チェック: `pyright`
- ログ: `structlog` で構造化JSON

## テスト

- `pytest` + `pytest-asyncio`
- テストファイルは `tests/` ディレクトリ
