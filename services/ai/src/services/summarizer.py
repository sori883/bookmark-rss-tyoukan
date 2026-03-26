import structlog
from pydantic import BaseModel
from strands import Agent

from src.config import get_settings
from src.schemas import ArticleResponse, DigestArticle

logger = structlog.get_logger(__name__)

SUMMARY_SYSTEM_PROMPT = """あなたは技術記事の要約者です。
与えられた記事のタイトルとURLから、各記事の簡潔な要約（2〜3文）を日本語で生成してください。

要約のポイント:
- 記事の主要なトピックを明確に伝える
- 技術的な重要性や影響を簡潔に説明する
- 読者が記事を読むかどうか判断できる情報を提供する"""


class ArticleSummary(BaseModel):
    url: str
    title: str
    summary: str


class SummarizedArticles(BaseModel):
    articles: list[ArticleSummary]


def summarize_articles(
    articles: list[ArticleResponse],
    model_id: str | None = None,
) -> list[DigestArticle]:
    if not articles:
        return []

    if model_id is None:
        model_id = get_settings().bedrock_model_id

    article_list = "\n".join(
        _format_article_for_prompt(article) for article in articles
    )
    prompt = f"以下の記事を要約してください。\n\n{article_list}"

    try:
        agent = Agent(
            model=model_id,
            system_prompt=SUMMARY_SYSTEM_PROMPT,
            tools=[],
            callback_handler=None,
            structured_output_model=SummarizedArticles,
        )
        result = agent(prompt)
    except Exception as e:
        logger.warning("summarization_failed", error=str(e))
        return _fallback_summarize(articles)

    digest_articles = _parse_summary_result(result, articles)
    if not digest_articles:
        logger.warning("summarization_empty_result")
        return _fallback_summarize(articles)

    logger.info("articles_summarized", count=len(digest_articles))
    return digest_articles


def _parse_summary_result(
    result: object, articles: list[ArticleResponse]
) -> list[DigestArticle]:
    try:
        structured: SummarizedArticles | None = getattr(result, "structured_output", None)
        if structured is None:
            return []

        url_to_image = {a.url: a.og_image_url for a in articles}
        return [
            DigestArticle(
                url=s.url,
                title=s.title,
                summary=s.summary,
                og_image_url=url_to_image.get(s.url),
            )
            for s in structured.articles
        ]
    except Exception as e:
        logger.warning("summary_parse_failed", error=str(e))
        return []


MAX_DESCRIPTION_LENGTH = 300


def _format_article_for_prompt(article: ArticleResponse) -> str:
    lines = [f"- タイトル: {article.title}", f"  URL: {article.url}"]
    if article.description:
        desc = article.description[:MAX_DESCRIPTION_LENGTH]
        lines.append(f"  概要: {desc}")
    return "\n".join(lines)


def _fallback_summarize(articles: list[ArticleResponse]) -> list[DigestArticle]:
    """要約失敗時のフォールバック: タイトルのみで DigestArticle を作成。"""
    logger.info("using_fallback_summarize")
    return [
        DigestArticle(
            url=a.url,
            title=a.title,
            summary=a.title,
            og_image_url=a.og_image_url,
        )
        for a in articles
    ]
