from unittest.mock import MagicMock, patch

from src.schemas import ArticleResponse
from src.services.summarizer import (
    ArticleSummary,
    SummarizedArticles,
    summarize_articles,
)


class TestSummarizeArticles:
    def test_empty_list_returns_empty(self) -> None:
        assert summarize_articles([]) == []

    @patch("src.services.summarizer.Agent")
    def test_summarizes_articles_via_agent(
        self,
        mock_agent_cls: MagicMock,
        sample_articles: list[ArticleResponse],
    ) -> None:
        mock_result = MagicMock()
        mock_result.structured_output = SummarizedArticles(
            articles=[
                ArticleSummary(
                    url=sample_articles[0].url,
                    title=sample_articles[0].title,
                    summary="This is a summary.",
                )
            ]
        )
        mock_agent_instance = MagicMock()
        mock_agent_instance.return_value = mock_result
        mock_agent_cls.return_value = mock_agent_instance

        result = summarize_articles(sample_articles[:1])
        assert len(result) == 1
        assert result[0].summary == "This is a summary."

    @patch("src.services.summarizer.Agent")
    def test_fallback_on_agent_error(
        self,
        mock_agent_cls: MagicMock,
        sample_articles: list[ArticleResponse],
    ) -> None:
        mock_agent_cls.side_effect = RuntimeError("Agent failed")

        result = summarize_articles(sample_articles[:2])
        assert len(result) == 2
        # Fallback uses title as summary
        assert result[0].summary == result[0].title

    @patch("src.services.summarizer.Agent")
    def test_fallback_on_empty_structured_output(
        self,
        mock_agent_cls: MagicMock,
        sample_articles: list[ArticleResponse],
    ) -> None:
        mock_result = MagicMock()
        mock_result.structured_output = None
        mock_agent_instance = MagicMock()
        mock_agent_instance.return_value = mock_result
        mock_agent_cls.return_value = mock_agent_instance

        result = summarize_articles(sample_articles[:1])
        assert len(result) == 1
        assert result[0].summary == sample_articles[0].title
