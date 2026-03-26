import random
from datetime import UTC, datetime

import structlog
from pydantic import BaseModel
from strands import Agent

from src.config import get_settings
from src.schemas import ArticleResponse, BookmarkResponse

logger = structlog.get_logger(__name__)

SELECTION_SYSTEM_PROMPT = (
    "あなたは記事キュレーターです。"
    "番号付きの記事リストから、ユーザーにおすすめの記事を8件選定してください。\n\n"
    "## 選定ルール（8件厳守）\n"
    "- ユーザーのブックマーク傾向と同じジャンル・分野の記事を選定。\n"
    "- ブックマーク傾向と無関係なジャンルの記事は選定しないこと。\n"
    "- 必ず8件ちょうど選定すること。8件を超えてはいけない。\n\n"
    "ブックマーク傾向が提供されていない場合は、"
    "話題性の高い記事を8件選定してください。\n"
    "記事が8件以下の場合は全件選定してください。\n\n"
    "選定結果は記事の番号で返してください。"
)

MAX_RECOMMENDED = 8
MAX_RANDOM = 2
MAX_INPUT_ARTICLES = 100
MIN_ARTICLES_FOR_SELECTION = 8


class SelectionResult(BaseModel):
    """AI が選定した記事の番号リスト。"""

    recommended: list[int]


def select_articles(
    articles: list[ArticleResponse],
    bookmarks: list[BookmarkResponse] | None = None,
    model_id: str | None = None,
) -> tuple[list[ArticleResponse], list[ArticleResponse]]:
    """記事を選定する。

    Returns:
        (recommended_articles, random_articles) のタプル
        recommended: AIがブックマーク傾向に基づき選定（最大8件）
        random: 未読からランダム選出（最大2件、recommended と重複なし）
    """
    if not articles:
        return [], []

    if model_id is None:
        model_id = get_settings().bedrock_model_id

    if len(articles) <= MIN_ARTICLES_FOR_SELECTION:
        logger.info(
            "skipping_selection",
            reason="too_few_articles",
            count=len(articles),
        )
        return articles, []

    # 入力記事を100件に制限（最新順）
    sorted_articles = sorted(
        articles,
        key=lambda a: a.published_at or datetime.min.replace(tzinfo=UTC),
        reverse=True,
    )
    input_articles = sorted_articles[:MAX_INPUT_ARTICLES]

    bookmark_section = ""
    if bookmarks:
        bookmark_titles = "\n".join(f"- {b.title}" for b in bookmarks)
        bookmark_section = (
            f"## ユーザーのブックマーク傾向\n\n{bookmark_titles}\n\n"
        )

    article_list = "\n".join(
        f"{i}. {article.title}"
        for i, article in enumerate(input_articles, 1)
    )
    prompt = (
        f"{bookmark_section}"
        f"## 記事リスト\n\n{article_list}"
    )

    try:
        agent = Agent(
            model=model_id,
            system_prompt=SELECTION_SYSTEM_PROMPT,
            tools=[],
            callback_handler=None,
            structured_output_model=SelectionResult,
        )
        result = agent(prompt)
    except Exception as e:
        logger.warning("article_selection_failed", error=str(e))
        return _fallback_selection(input_articles)

    recommended = _parse_selection_result(result, input_articles)
    if not recommended:
        logger.warning("article_selection_empty_result")
        return _fallback_selection(input_articles)

    # ランダム2件（recommended と重複しない未読から選出）
    recommended_urls = {a.url for a in recommended}
    candidates = [a for a in articles if a.url not in recommended_urls]
    random_picks = random.sample(
        candidates, min(MAX_RANDOM, len(candidates))
    )

    logger.info(
        "articles_selected",
        total=len(articles),
        input=len(input_articles),
        recommended=len(recommended),
        random=len(random_picks),
    )
    return recommended, random_picks


def _parse_selection_result(
    result: object, articles: list[ArticleResponse]
) -> list[ArticleResponse]:
    try:
        structured: SelectionResult | None = getattr(
            result, "structured_output", None
        )
        if structured is None:
            return []

        max_idx = len(articles)
        recommended = [
            articles[i - 1]
            for i in structured.recommended
            if 1 <= i <= max_idx
        ][:MAX_RECOMMENDED]

        return recommended
    except Exception as e:
        logger.warning("selection_parse_failed", error=str(e))
        return []


def _fallback_selection(
    articles: list[ArticleResponse],
) -> tuple[list[ArticleResponse], list[ArticleResponse]]:
    """選定失敗時のフォールバック: 最新8件+ランダム2件。"""
    logger.info("using_fallback_selection")
    sorted_articles = sorted(
        articles,
        key=lambda a: a.published_at or datetime.min.replace(tzinfo=UTC),
        reverse=True,
    )
    recommended = sorted_articles[:MAX_RECOMMENDED]
    remaining = sorted_articles[MAX_RECOMMENDED:]
    random_picks = random.sample(
        remaining, min(MAX_RANDOM, len(remaining))
    )
    return recommended, random_picks
