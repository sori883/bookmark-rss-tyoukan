import asyncio
from collections import defaultdict
from datetime import UTC, datetime, timedelta

import structlog
from fastapi import APIRouter, Request

from src.clients.feed_client import FeedClient
from src.clients.notification_client import NotificationClient
from src.lib.errors import NotificationServiceError
from src.schemas import ArticleResponse, DigestArticle, DigestRequest, DigestResponse
from src.services.article_selector import select_articles
from src.services.summarizer import summarize_articles

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.post("/digest", response_model=DigestResponse)
async def run_digest(request: Request, body: DigestRequest) -> DigestResponse:
    feed_client: FeedClient = request.app.state.feed_client
    notification_client: NotificationClient = request.app.state.notification_client

    since = body.since or _default_since()
    logger.info("digest_started", since=since.isoformat())

    articles = await feed_client.get_unread_articles()
    articles = _filter_by_since(articles, since)

    if not articles:
        logger.info("digest_no_articles")
        return DigestResponse(selected_count=0, notified=False, articles=[])

    selected = await asyncio.to_thread(select_articles, articles)
    digest_articles = await asyncio.to_thread(summarize_articles, selected)

    notified = await _notify_users(
        articles=selected,
        digest_articles=digest_articles,
        notification_client=notification_client,
    )

    logger.info(
        "digest_completed",
        selected_count=len(digest_articles),
        notified=notified,
    )

    return DigestResponse(
        selected_count=len(digest_articles),
        notified=notified,
        articles=digest_articles,
    )


def _default_since() -> datetime:
    return datetime.now(UTC) - timedelta(days=1)


def _filter_by_since(
    articles: list[ArticleResponse], since: datetime
) -> list[ArticleResponse]:
    return [a for a in articles if a.published_at >= since]


def _build_digest_message(digest_articles: list[DigestArticle]) -> str:
    lines = ["# 本日の注目記事ダイジェスト\n"]
    for article in digest_articles:
        lines.append(f"## {article.title}")
        lines.append(f"{article.summary}")
        lines.append(f"[記事を読む]({article.url})\n")
    return "\n".join(lines)


def _group_articles_by_user(
    articles: list[ArticleResponse],
) -> dict[str, list[ArticleResponse]]:
    grouped: dict[str, list[ArticleResponse]] = defaultdict(list)
    for article in articles:
        grouped[article.user_id].append(article)
    return dict(grouped)


async def _notify_users(
    articles: list[ArticleResponse],
    digest_articles: list[DigestArticle],
    notification_client: NotificationClient,
) -> bool:
    user_groups = _group_articles_by_user(articles)
    message = _build_digest_message(digest_articles)
    all_sent = True

    for user_id in user_groups:
        try:
            await notification_client.send_digest(user_id=user_id, message=message)
        except NotificationServiceError:
            logger.error("notification_failed_for_user", user_id=user_id)
            all_sent = False

    return all_sent
