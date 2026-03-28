import asyncio
from datetime import datetime, timedelta, timezone

import structlog
from fastapi import APIRouter, Request

from src.clients.feed_client import FeedClient
from src.clients.notification_client import NotificationClient
from src.config import get_settings
from src.lib.errors import NotificationServiceError
from src.lib.ogp import fetch_og_images
from src.schemas import (
    ArticleResponse,
    DigestArticle,
    DigestRequest,
    DigestResponse,
    NotificationTarget,
)
from src.services.article_selector import select_articles
from src.services.summarizer import summarize_articles

logger = structlog.get_logger(__name__)

router = APIRouter()

JST = timezone(timedelta(hours=9))

BOOKMARK_LIMIT = 50


@router.post("/digest", response_model=DigestResponse)
async def run_digest(request: Request, body: DigestRequest) -> DigestResponse:
    feed_client: FeedClient = request.app.state.feed_client
    notification_client: NotificationClient = request.app.state.notification_client
    return await execute_digest(feed_client, notification_client, body)


async def execute_digest(
    feed_client: FeedClient,
    notification_client: NotificationClient,
    body: DigestRequest,
) -> DigestResponse:
    since = body.since or _default_since()
    logger.info("digest_started", since=since.isoformat())

    # 対象ユーザーの決定
    if body.user_id:
        # user_id 指定: そのユーザーのみ処理
        all_targets = await feed_client.get_notification_targets()
        targets = [t for t in all_targets if t.user_id == body.user_id]
    elif body.skip_hour_filter:
        logger.info("digest_skip_hour_filter")
        targets = await feed_client.get_notification_targets()
    else:
        # 定期実行: 通知時間が一致するユーザーのみ
        all_targets = await feed_client.get_notification_targets()
        current_hour = datetime.now(JST).hour
        targets = _filter_by_notification_hour(all_targets, current_hour)

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

        # ブックマーク傾向を取得し、記事選定（1 LLM call）
        bookmarks = await feed_client.get_recent_bookmarks(
            user_id, limit=BOOKMARK_LIMIT
        )
        recommended, random_picks = await asyncio.to_thread(
            select_articles, articles, bookmarks or None
        )

        # OGP画像を並列取得（選定記事のみ）
        all_selected = [*recommended, *random_picks]
        og_images = await fetch_og_images([a.url for a in all_selected])

        # 要約生成（1 LLM call）
        digest_articles = await asyncio.to_thread(
            summarize_articles, all_selected
        )
        # OGP画像をダイジェスト記事に反映
        for da in digest_articles:
            if og_images.get(da.url):
                da.og_image_url = og_images[da.url]

        # レコメンドとランダムを分離
        recommended_urls = {a.url for a in recommended}
        rec_digests = [d for d in digest_articles if d.url in recommended_urls]
        random_digests = [
            d for d in digest_articles if d.url not in recommended_urls
        ]
        all_digest_articles = [*all_digest_articles, *digest_articles]

        # Markdown + Discord短文を生成
        web_origin = get_settings().web_origin
        markdown_message = _build_markdown_message(
            rec_digests, random_digests, web_origin
        )
        webhook_message = _build_webhook_message(
            len(digest_articles), web_origin
        )

        # 通知送信
        try:
            await notification_client.send_digest(
                user_id=user_id,
                message=markdown_message,
                webhook_message=webhook_message,
            )
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
    """デフォルトの since: JST 基準で1日前。"""
    return datetime.now(JST) - timedelta(days=1)


def _filter_by_since(
    articles: list[ArticleResponse], since: datetime
) -> list[ArticleResponse]:
    return [
        a for a in articles
        if a.published_at is not None and a.published_at >= since
    ]


def _build_markdown_message(
    recommended: list[DigestArticle],
    random_picks: list[DigestArticle],
    web_origin: str,
) -> str:
    from urllib.parse import quote

    today = datetime.now(JST).strftime("%Y-%m-%d")

    lines = [f"# 本日のダイジェスト（{today}）", ""]

    if recommended:
        for article in recommended:
            bookmark_url = (
                f"{web_origin}/bookmark-add"
                f"?url={quote(article.url, safe='')}"
            )
            lines.append(f"## {article.title}")
            lines.append("")
            if article.og_image_url:
                lines.append(
                    f"![{article.title}]({article.og_image_url})"
                )
                lines.append("")
            lines.append(article.summary)
            lines.append("")
            lines.append(
                f"[記事を読む]({article.url})"
                f" | [ブックマーク]({bookmark_url})"
            )
            lines.append("")
            lines.append("---")
            lines.append("")

    if random_picks:
        lines.append("# ピックアップ")
        lines.append("")
        for article in random_picks:
            bookmark_url = (
                f"{web_origin}/bookmark-add"
                f"?url={quote(article.url, safe='')}"
            )
            lines.append(f"## {article.title}")
            lines.append("")
            if article.og_image_url:
                lines.append(
                    f"![{article.title}]({article.og_image_url})"
                )
                lines.append("")
            lines.append(article.summary)
            lines.append("")
            lines.append(
                f"[記事を読む]({article.url})"
                f" | [ブックマーク]({bookmark_url})"
            )
            lines.append("")
            lines.append("---")
            lines.append("")

    return "\n".join(lines)


def _build_webhook_message(
    article_count: int,
    web_origin: str,
) -> str:
    return (
        f"📰 本日のダイジェスト（{article_count}件）\n"
        f"▶ スライドで読む: {web_origin}/notifications"
    )


def _filter_by_notification_hour(
    targets: list[NotificationTarget], current_hour: int
) -> list[NotificationTarget]:
    """現在時刻（JST hour）と一致する通知時間のユーザーのみ返す。"""
    return [t for t in targets if t.notification_hour == current_hour]
