from datetime import UTC, datetime
from unittest.mock import AsyncMock

import httpx
import pytest

from src.lib.auth import ServiceTokenManager
from src.schemas import ArticleResponse


@pytest.fixture(autouse=True)
def _set_env(monkeypatch: pytest.MonkeyPatch) -> None:
    env_vars = {
        "AUTH_SERVICE_URL": "http://auth:3000",
        "FEED_SERVICE_URL": "http://feed:3001",
        "NOTIFICATION_SERVICE_URL": "http://notification:3004",
        "AI_CLIENT_ID": "test-client-id",
        "AI_CLIENT_SECRET": "test-client-secret",
        "AWS_REGION": "us-east-1",
        "LOG_LEVEL": "debug",
    }
    for key, value in env_vars.items():
        monkeypatch.setenv(key, value)


@pytest.fixture
def http_client() -> AsyncMock:
    return AsyncMock(spec=httpx.AsyncClient)


@pytest.fixture
def token_manager(http_client: AsyncMock) -> ServiceTokenManager:
    return ServiceTokenManager(
        http_client=http_client,
        auth_service_url="http://auth:3000",
        client_id="test-client-id",
        client_secret="test-client-secret",
        cache_margin_seconds=300,
    )


@pytest.fixture
def sample_articles() -> list[ArticleResponse]:
    return [
        ArticleResponse(
            id=f"article-{i}",
            user_id="user-1" if i < 3 else "user-2",
            feed_id="feed-1",
            url=f"https://example.com/article-{i}",
            title=f"Test Article {i}",
            is_read=False,
            published_at=datetime(2026, 3, 24, i, 0, 0, tzinfo=UTC),
            created_at=datetime(2026, 3, 24, i, 0, 0, tzinfo=UTC),
            updated_at=datetime(2026, 3, 24, i, 0, 0, tzinfo=UTC),
        )
        for i in range(5)
    ]
