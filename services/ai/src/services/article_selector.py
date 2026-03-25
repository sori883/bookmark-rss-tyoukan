import structlog
from pydantic import BaseModel
from strands import Agent

from src.config import get_settings
from src.schemas import ArticleResponse

logger = structlog.get_logger(__name__)

SELECTION_SYSTEM_PROMPT = """あなたは技術記事キュレーターです。
与えられた記事リストから、技術的に興味深い・話題性のある注目記事を選定してください。

選定基準:
- 新しい技術トレンドや重要なアップデート
- セキュリティに関する重要な情報
- 開発者コミュニティで話題になりそうな内容
- 実用的で学びのある技術記事

最大10件を選定してください。記事が5件以下の場合は全件選定してください。"""

MIN_ARTICLES_FOR_SELECTION = 5


class SelectedArticles(BaseModel):
    """AI が選定した記事の URL リスト。"""

    selected_urls: list[str]


def select_articles(
    articles: list[ArticleResponse],
    model_id: str | None = None,
) -> list[ArticleResponse]:
    if not articles:
        return []

    if model_id is None:
        model_id = get_settings().bedrock_model_id

    if len(articles) <= MIN_ARTICLES_FOR_SELECTION:
        logger.info("skipping_selection", reason="too_few_articles", count=len(articles))
        return articles

    article_list = "\n".join(
        f"- [{article.title}]({article.url})" for article in articles
    )
    prompt = (
        "以下の記事リストから注目記事を選定し、"
        f"選定した記事のURLリストを返してください。\n\n{article_list}"
    )

    try:
        agent = Agent(
            model=model_id,
            system_prompt=SELECTION_SYSTEM_PROMPT,
            tools=[],
            callback_handler=None,
            structured_output_model=SelectedArticles,
        )
        result = agent(prompt)
    except Exception as e:
        logger.warning("article_selection_failed", error=str(e))
        return _fallback_selection(articles)

    selected = _parse_selection_result(result, articles)
    if not selected:
        logger.warning("article_selection_empty_result")
        return _fallback_selection(articles)

    logger.info("articles_selected", total=len(articles), selected=len(selected))
    return selected


def _parse_selection_result(
    result: object, articles: list[ArticleResponse]
) -> list[ArticleResponse]:
    try:
        structured: SelectedArticles | None = getattr(result, "structured_output", None)
        if structured is None:
            return []

        url_set = set(structured.selected_urls)
        return [a for a in articles if a.url in url_set]
    except Exception as e:
        logger.warning("selection_parse_failed", error=str(e))
        return []


def _fallback_selection(articles: list[ArticleResponse]) -> list[ArticleResponse]:
    """選定失敗時のフォールバック: 最新10件を返す。"""
    logger.info("using_fallback_selection")
    sorted_articles = sorted(articles, key=lambda a: a.published_at, reverse=True)
    return sorted_articles[:10]
