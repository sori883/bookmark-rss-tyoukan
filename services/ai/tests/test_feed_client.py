from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from src.clients.feed_client import FeedClient
from src.lib.auth import ServiceTokenManager
from src.lib.errors import FeedServiceError


@pytest.fixture
def feed_client(
    http_client: AsyncMock, token_manager: ServiceTokenManager
) -> FeedClient:
    token_manager._cached_token = "test-token"
    token_manager._expires_at = float("inf")
    return FeedClient(
        http_client=http_client,
        base_url="http://feed:3001",
        token_manager=token_manager,
        page_size=100,
    )


class TestFeedClient:
    async def test_get_unread_articles_single_page(
        self, feed_client: FeedClient, http_client: AsyncMock
    ) -> None:
        mock_response = AsyncMock(spec=httpx.Response)
        mock_response.json.return_value = {
            "data": [
                {
                    "id": "a1",
                    "user_id": "u1",
                    "feed_id": "f1",
                    "url": "https://example.com/1",
                    "title": "Article 1",
                    "is_read": False,
                    "published_at": "2026-03-24T00:00:00Z",
                    "created_at": "2026-03-24T00:00:00Z",
                    "updated_at": "2026-03-24T00:00:00Z",
                }
            ],
            "total": 1,
            "page": 1,
            "limit": 100,
        }
        mock_response.raise_for_status = MagicMock()
        http_client.get.return_value = mock_response

        articles = await feed_client.get_unread_articles()
        assert len(articles) == 1
        assert articles[0].title == "Article 1"

    async def test_get_unread_articles_pagination(
        self, feed_client: FeedClient, http_client: AsyncMock
    ) -> None:
        page1_response = AsyncMock(spec=httpx.Response)
        page1_response.json.return_value = {
            "data": [
                {
                    "id": "a1",
                    "user_id": "u1",
                    "feed_id": "f1",
                    "url": "https://example.com/1",
                    "title": "Article 1",
                    "is_read": False,
                    "published_at": "2026-03-24T00:00:00Z",
                    "created_at": "2026-03-24T00:00:00Z",
                    "updated_at": "2026-03-24T00:00:00Z",
                }
            ],
            "total": 2,
            "page": 1,
            "limit": 1,
        }
        page1_response.raise_for_status = MagicMock()

        page2_response = AsyncMock(spec=httpx.Response)
        page2_response.json.return_value = {
            "data": [
                {
                    "id": "a2",
                    "user_id": "u1",
                    "feed_id": "f1",
                    "url": "https://example.com/2",
                    "title": "Article 2",
                    "is_read": False,
                    "published_at": "2026-03-24T00:00:00Z",
                    "created_at": "2026-03-24T00:00:00Z",
                    "updated_at": "2026-03-24T00:00:00Z",
                }
            ],
            "total": 2,
            "page": 2,
            "limit": 1,
        }
        page2_response.raise_for_status = MagicMock()

        http_client.get.side_effect = [page1_response, page2_response]
        feed_client._page_size = 1

        articles = await feed_client.get_unread_articles()
        assert len(articles) == 2

    async def test_get_unread_articles_empty(
        self, feed_client: FeedClient, http_client: AsyncMock
    ) -> None:
        mock_response = AsyncMock(spec=httpx.Response)
        mock_response.json.return_value = {
            "data": [],
            "total": 0,
            "page": 1,
            "limit": 100,
        }
        mock_response.raise_for_status = MagicMock()
        http_client.get.return_value = mock_response

        articles = await feed_client.get_unread_articles()
        assert articles == []

    async def test_raises_on_feed_error(
        self, feed_client: FeedClient, http_client: AsyncMock
    ) -> None:
        mock_response = AsyncMock(spec=httpx.Response)
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Internal Server Error", request=AsyncMock(), response=mock_response
        )
        http_client.get.return_value = mock_response

        with pytest.raises(FeedServiceError):
            await feed_client.get_unread_articles()
