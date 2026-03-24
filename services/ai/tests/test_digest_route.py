from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.lib.errors import FeedServiceError, NotificationServiceError
from src.schemas import ArticleResponse, DigestArticle, NotifyResponse


@pytest.fixture
def mock_feed_client() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def mock_notification_client() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def client(
    mock_feed_client: AsyncMock,
    mock_notification_client: AsyncMock,
) -> TestClient:
    from src.main import app

    app.state.feed_client = mock_feed_client
    app.state.notification_client = mock_notification_client
    return TestClient(app, raise_server_exceptions=False)


def _make_articles(count: int) -> list[ArticleResponse]:
    return [
        ArticleResponse(
            id=f"article-{i}",
            user_id="user-1" if i < count // 2 else "user-2",
            feed_id="feed-1",
            url=f"https://example.com/article-{i}",
            title=f"Test Article {i}",
            is_read=False,
            published_at=datetime(2026, 3, 24, i % 24, 0, 0, tzinfo=UTC),
            created_at=datetime(2026, 3, 24, i % 24, 0, 0, tzinfo=UTC),
            updated_at=datetime(2026, 3, 24, i % 24, 0, 0, tzinfo=UTC),
        )
        for i in range(count)
    ]


class TestDigestRoute:
    @patch("src.routes.digest.summarize_articles")
    @patch("src.routes.digest.select_articles")
    def test_normal_flow(
        self,
        mock_select: MagicMock,
        mock_summarize: MagicMock,
        client: TestClient,
        mock_feed_client: AsyncMock,
        mock_notification_client: AsyncMock,
    ) -> None:
        articles = _make_articles(6)
        mock_feed_client.get_unread_articles.return_value = articles
        mock_select.return_value = articles[:2]
        mock_summarize.return_value = [
            DigestArticle(url="https://example.com/article-0", title="Test 0", summary="Sum 0"),
            DigestArticle(url="https://example.com/article-1", title="Test 1", summary="Sum 1"),
        ]
        mock_notification_client.send_digest.return_value = NotifyResponse(
            id="notif-1", webhook_sent=True
        )

        response = client.post(
            "/digest",
            json={"since": "2026-03-23T00:00:00Z"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["selected_count"] == 2
        assert data["notified"] is True

    def test_no_articles(
        self,
        client: TestClient,
        mock_feed_client: AsyncMock,
    ) -> None:
        mock_feed_client.get_unread_articles.return_value = []

        response = client.post(
            "/digest",
            json={"since": "2026-03-23T00:00:00Z"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["selected_count"] == 0
        assert data["notified"] is False
        assert data["articles"] == []

    def test_feed_service_error(
        self,
        client: TestClient,
        mock_feed_client: AsyncMock,
    ) -> None:
        mock_feed_client.get_unread_articles.side_effect = FeedServiceError("Feed down")

        response = client.post(
            "/digest",
            json={"since": "2026-03-23T00:00:00Z"},
        )
        assert response.status_code == 502
        data = response.json()
        assert data["error"]["code"] == "FEED_SERVICE_ERROR"

    @patch("src.routes.digest.summarize_articles")
    @patch("src.routes.digest.select_articles")
    def test_notification_partial_failure(
        self,
        mock_select: MagicMock,
        mock_summarize: MagicMock,
        client: TestClient,
        mock_feed_client: AsyncMock,
        mock_notification_client: AsyncMock,
    ) -> None:
        articles = _make_articles(6)
        mock_feed_client.get_unread_articles.return_value = articles
        mock_select.return_value = articles[:4]
        mock_summarize.return_value = [
            DigestArticle(url=f"https://example.com/article-{i}", title=f"T{i}", summary=f"S{i}")
            for i in range(4)
        ]
        mock_notification_client.send_digest.side_effect = [
            NotifyResponse(id="n1", webhook_sent=True),
            NotificationServiceError("Failed"),
        ]

        response = client.post(
            "/digest",
            json={"since": "2026-03-23T00:00:00Z"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["notified"] is False

    def test_default_since(
        self,
        client: TestClient,
        mock_feed_client: AsyncMock,
    ) -> None:
        mock_feed_client.get_unread_articles.return_value = []

        response = client.post("/digest", json={})
        assert response.status_code == 200
