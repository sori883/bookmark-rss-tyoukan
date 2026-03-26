from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from src.lib.errors import FeedServiceError, NotificationServiceError
from src.schemas import (
    ArticleResponse,
    BookmarkResponse,
    DigestArticle,
    NotificationTarget,
    NotifyResponse,
)


@pytest.fixture
def mock_feed_client() -> AsyncMock:
    client = AsyncMock()
    client.get_recent_bookmarks.return_value = []
    return client


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


NOTIFICATION_TARGET = NotificationTarget(
    user_id="user-1",
    webhook_url="https://hooks.slack.com/test",
    webhook_type="slack",
    notification_hour=9,
)


def _make_articles(count: int, user_id: str = "user-1") -> list[ArticleResponse]:
    return [
        ArticleResponse(
            id=f"article-{i}",
            user_id=user_id,
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
        articles = _make_articles(12)
        mock_feed_client.get_notification_targets.return_value = [NOTIFICATION_TARGET]
        mock_feed_client.get_unread_articles_for_user.return_value = articles
        mock_select.return_value = (articles[:3], [articles[4]])
        mock_summarize.return_value = [
            DigestArticle(url=f"https://example.com/article-{i}", title=f"T{i}", summary=f"S{i}")
            for i in [0, 1, 2, 4]
        ]
        mock_notification_client.send_digest.return_value = NotifyResponse(
            id="notif-1", webhook_sent=True
        )

        response = client.post(
            "/digest",
            json={"since": "2026-03-23T00:00:00Z", "skip_hour_filter": True},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["selected_count"] == 4  # 3 recommended + 1 featured
        assert data["notified"] is True

    @patch("src.routes.digest.summarize_articles")
    @patch("src.routes.digest.select_articles")
    def test_flow_with_bookmarks(
        self,
        mock_select: MagicMock,
        mock_summarize: MagicMock,
        client: TestClient,
        mock_feed_client: AsyncMock,
        mock_notification_client: AsyncMock,
    ) -> None:
        articles = _make_articles(12)
        bm = [
            BookmarkResponse(
                id="bm-1",
                user_id="user-1",
                url="https://example.com/bm",
                title="Bookmarked",
                content_markdown="content",
                created_at=datetime(2026, 3, 24, 0, 0, 0, tzinfo=UTC),
                updated_at=datetime(2026, 3, 24, 0, 0, 0, tzinfo=UTC),
            ),
        ]
        mock_feed_client.get_notification_targets.return_value = [NOTIFICATION_TARGET]
        mock_feed_client.get_unread_articles_for_user.return_value = articles
        mock_feed_client.get_recent_bookmarks.return_value = bm
        mock_select.return_value = (articles[:5], [articles[6]])
        mock_summarize.return_value = [
            DigestArticle(url=f"https://example.com/article-{i}", title=f"T{i}", summary=f"S{i}")
            for i in [0, 1, 2, 3, 4, 6]
        ]
        mock_notification_client.send_digest.return_value = NotifyResponse(
            id="notif-1", webhook_sent=True
        )

        response = client.post(
            "/digest",
            json={"since": "2026-03-23T00:00:00Z", "skip_hour_filter": True},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["selected_count"] == 6
        mock_select.assert_called_once_with(articles, bm)

    def test_no_notification_targets(
        self,
        client: TestClient,
        mock_feed_client: AsyncMock,
    ) -> None:
        mock_feed_client.get_notification_targets.return_value = []

        response = client.post(
            "/digest",
            json={"since": "2026-03-23T00:00:00Z", "skip_hour_filter": True},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["selected_count"] == 0
        assert data["notified"] is False

    def test_no_articles(
        self,
        client: TestClient,
        mock_feed_client: AsyncMock,
    ) -> None:
        mock_feed_client.get_notification_targets.return_value = [NOTIFICATION_TARGET]
        mock_feed_client.get_unread_articles_for_user.return_value = []

        response = client.post(
            "/digest",
            json={"since": "2026-03-23T00:00:00Z", "skip_hour_filter": True},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["selected_count"] == 0

    def test_feed_service_error(
        self,
        client: TestClient,
        mock_feed_client: AsyncMock,
    ) -> None:
        mock_feed_client.get_notification_targets.side_effect = FeedServiceError("Feed down")

        response = client.post(
            "/digest",
            json={"since": "2026-03-23T00:00:00Z", "skip_hour_filter": True},
        )
        assert response.status_code == 502

    @patch("src.routes.digest.summarize_articles")
    @patch("src.routes.digest.select_articles")
    def test_notification_failure(
        self,
        mock_select: MagicMock,
        mock_summarize: MagicMock,
        client: TestClient,
        mock_feed_client: AsyncMock,
        mock_notification_client: AsyncMock,
    ) -> None:
        articles = _make_articles(12)
        mock_feed_client.get_notification_targets.return_value = [NOTIFICATION_TARGET]
        mock_feed_client.get_unread_articles_for_user.return_value = articles
        mock_select.return_value = (articles[:2], [])
        mock_summarize.return_value = [
            DigestArticle(url=f"https://example.com/article-{i}", title=f"T{i}", summary=f"S{i}")
            for i in range(2)
        ]
        mock_notification_client.send_digest.side_effect = NotificationServiceError("Failed")

        response = client.post(
            "/digest",
            json={"since": "2026-03-23T00:00:00Z", "skip_hour_filter": True},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["notified"] is False

    def test_default_since(
        self,
        client: TestClient,
        mock_feed_client: AsyncMock,
    ) -> None:
        mock_feed_client.get_notification_targets.return_value = []

        response = client.post("/digest", json={})
        assert response.status_code == 200

    @patch("src.routes.digest.summarize_articles")
    @patch("src.routes.digest.select_articles")
    def test_markdown_message_format(
        self,
        mock_select: MagicMock,
        mock_summarize: MagicMock,
        client: TestClient,
        mock_feed_client: AsyncMock,
        mock_notification_client: AsyncMock,
    ) -> None:
        articles = _make_articles(12)
        mock_feed_client.get_notification_targets.return_value = [NOTIFICATION_TARGET]
        mock_feed_client.get_unread_articles_for_user.return_value = articles
        mock_select.return_value = (articles[:1], [articles[2]])
        mock_summarize.return_value = [
            DigestArticle(url="https://example.com/article-0", title="Rec", summary="RecSum"),
            DigestArticle(url="https://example.com/article-2", title="Feat", summary="FeatSum"),
        ]
        mock_notification_client.send_digest.return_value = NotifyResponse(
            id="notif-1", webhook_sent=True
        )

        client.post(
            "/digest",
            json={"since": "2026-03-23T00:00:00Z", "skip_hour_filter": True},
        )

        call_kwargs = mock_notification_client.send_digest.call_args
        message = call_kwargs.kwargs.get("message", "")
        webhook_message = call_kwargs.kwargs.get("webhook_message", "")

        # Markdown にレコメンド + 注目セクション
        assert "# 本日のダイジェスト" in message
        assert "# 注目記事" in message
        assert "ブックマーク" in message

        # 短文通知
        assert "ダイジェスト" in webhook_message
        assert "2件" in webhook_message
