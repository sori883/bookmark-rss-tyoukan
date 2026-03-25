import asyncio
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

    # 通知設定済みユーザー一覧を取得
    targets = await feed_client.get_notification_targets()
    if not targets:
        logger.info("digest_no_notification_targets")
        return DigestResponse(selected_count=0, notified=False, articles=[])

    all_digest_articles: list[DigestArticle] = []
    notified = True

    for target in targets:
        user_id = target.user_id
        logger.info("digest_processing_user", user_id=user_id)

        # ユーザーの未読記事を取得
        articles = await feed_client.get_unread_articles_for_user(user_id)
        articles = _filter_by_since(articles, since)

        if not articles:
            logger.info("digest_no_articles_for_user", user_id=user_id)
            continue

        # 記事選定・要約
        selected = await asyncio.to_thread(select_articles, articles)
        digest_articles = await asyncio.to_thread(summarize_articles, selected)
        all_digest_articles = [*all_digest_articles, *digest_articles]

        # 通知送信
        message = _build_digest_message(digest_articles)
        try:
            await notification_client.send_digest(user_id=user_id, message=message)
        except NotificationServiceError:
            logger.error("notification_failed_for_user", user_id=user_id)
            notified = False

    logger.info(
        "digest_completed",
        selected_count=len(all_digest_articles),
        notified=notified,
    )

    return DigestResponse(
        selected_count=len(all_digest_articles),
        notified=notified,
        articles=all_digest_articles,
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
