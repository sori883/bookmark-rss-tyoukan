from unittest.mock import MagicMock, patch

from src.schemas import ArticleResponse
from src.services.article_selector import (
    SelectedArticles,
    select_articles,
)


class TestSelectArticles:
    def test_empty_list_returns_empty(self) -> None:
        assert select_articles([]) == []

    def test_few_articles_returns_all(
        self, sample_articles: list[ArticleResponse]
    ) -> None:
        few = sample_articles[:3]
        result = select_articles(few)
        assert result == few

    @patch("src.services.article_selector.Agent")
    def test_selects_articles_via_agent(
        self,
        mock_agent_cls: MagicMock,
        sample_articles: list[ArticleResponse],
    ) -> None:
        # 6件以上にして選定ロジックを発動
        extra = sample_articles + [
            ArticleResponse(
                id="article-extra",
                user_id="user-1",
                feed_id="feed-1",
                url="https://example.com/extra",
                title="Extra Article",
                is_read=False,
                published_at=sample_articles[0].published_at,
                created_at=sample_articles[0].created_at,
                updated_at=sample_articles[0].updated_at,
            )
        ]

        mock_result = MagicMock()
        mock_result.structured_output = SelectedArticles(
            selected_urls=[
                "https://example.com/article-0",
                "https://example.com/article-1",
            ]
        )
        mock_agent_instance = MagicMock()
        mock_agent_instance.return_value = mock_result
        mock_agent_cls.return_value = mock_agent_instance

        result = select_articles(extra)
        assert len(result) == 2
        assert result[0].url == "https://example.com/article-0"

    @patch("src.services.article_selector.Agent")
    def test_fallback_on_agent_error(
        self,
        mock_agent_cls: MagicMock,
        sample_articles: list[ArticleResponse],
    ) -> None:
        extra = sample_articles + [
            ArticleResponse(
                id="article-extra",
                user_id="user-1",
                feed_id="feed-1",
                url="https://example.com/extra",
                title="Extra Article",
                is_read=False,
                published_at=sample_articles[0].published_at,
                created_at=sample_articles[0].created_at,
                updated_at=sample_articles[0].updated_at,
            )
        ]

        mock_agent_cls.side_effect = RuntimeError("Agent failed")

        result = select_articles(extra)
        # Fallback returns up to 10 articles sorted by published_at desc
        assert len(result) <= 10
        assert len(result) > 0

    @patch("src.services.article_selector.Agent")
    def test_fallback_on_empty_structured_output(
        self,
        mock_agent_cls: MagicMock,
        sample_articles: list[ArticleResponse],
    ) -> None:
        extra = sample_articles + [
            ArticleResponse(
                id="article-extra",
                user_id="user-1",
                feed_id="feed-1",
                url="https://example.com/extra",
                title="Extra Article",
                is_read=False,
                published_at=sample_articles[0].published_at,
                created_at=sample_articles[0].created_at,
                updated_at=sample_articles[0].updated_at,
            )
        ]

        mock_result = MagicMock()
        mock_result.structured_output = None
        mock_agent_instance = MagicMock()
        mock_agent_instance.return_value = mock_result
        mock_agent_cls.return_value = mock_agent_instance

        result = select_articles(extra)
        assert len(result) > 0
