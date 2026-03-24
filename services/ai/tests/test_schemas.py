from datetime import UTC, datetime

from src.schemas import (
    ArticleResponse,
    DigestArticle,
    DigestRequest,
    DigestResponse,
)


class TestDigestRequest:
    def test_since_optional(self) -> None:
        req = DigestRequest()
        assert req.since is None

    def test_since_with_datetime(self) -> None:
        dt = datetime(2026, 3, 24, 0, 0, 0, tzinfo=UTC)
        req = DigestRequest(since=dt)
        assert req.since == dt


class TestDigestResponse:
    def test_valid_response(self) -> None:
        resp = DigestResponse(
            selected_count=1,
            notified=True,
            articles=[
                DigestArticle(
                    url="https://example.com/1",
                    title="Test",
                    summary="Summary",
                )
            ],
        )
        assert resp.selected_count == 1
        assert resp.notified is True
        assert len(resp.articles) == 1

    def test_empty_articles(self) -> None:
        resp = DigestResponse(selected_count=0, notified=False, articles=[])
        assert resp.articles == []


class TestArticleResponse:
    def test_parses_all_fields(self) -> None:
        article = ArticleResponse(
            id="id-1",
            user_id="user-1",
            feed_id="feed-1",
            url="https://example.com",
            title="Title",
            is_read=False,
            published_at=datetime(2026, 3, 24, tzinfo=UTC),
            created_at=datetime(2026, 3, 24, tzinfo=UTC),
            updated_at=datetime(2026, 3, 24, tzinfo=UTC),
        )
        assert article.id == "id-1"
        assert article.is_read is False
