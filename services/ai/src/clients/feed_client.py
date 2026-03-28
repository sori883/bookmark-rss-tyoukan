import httpx
import structlog

from src.lib.auth import ServiceTokenManager
from src.lib.errors import FeedServiceError
from src.schemas import (
    ArticleResponse,
    BookmarkResponse,
    NotificationTarget,
    NotificationTargetsResponse,
    PaginatedArticlesResponse,
    PaginatedBookmarksResponse,
)

logger = structlog.get_logger(__name__)

MAX_PAGES = 50


class FeedClient:
    """feed サービスから記事を取得する HTTP クライアント。"""

    def __init__(
        self,
        http_client: httpx.AsyncClient,
        base_url: str,
        token_manager: ServiceTokenManager,
        page_size: int = 100,
    ) -> None:
        self._http_client = http_client
        self._base_url = base_url.rstrip('/')
        self._token_manager = token_manager
        self._page_size = page_size

    async def get_notification_targets(self) -> list[NotificationTarget]:
        """Webhook 設定済みユーザー一覧を取得する。"""
        token = await self._token_manager.get_token()
        headers = {"Authorization": f"Bearer {token}"}
        url = f"{self._base_url}/settings/notification-targets"

        try:
            response = await self._http_client.get(url, headers=headers)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(
                "notification_targets_request_failed",
                status=e.response.status_code,
            )
            raise FeedServiceError(
                f"Failed to fetch notification targets: {e.response.status_code}"
            ) from e
        except httpx.HTTPError as e:
            logger.error("notification_targets_request_error", error=str(e))
            raise FeedServiceError(
                f"Failed to connect to feed service: {e}"
            ) from e

        result = NotificationTargetsResponse.model_validate(response.json())
        logger.info("fetched_notification_targets", count=len(result.data))
        return result.data

    async def get_unread_articles_for_user(
        self, user_id: str
    ) -> list[ArticleResponse]:
        """指定ユーザーの未読記事を取得する。"""
        token = await self._token_manager.get_token()
        headers = {"Authorization": f"Bearer {token}"}
        all_articles: list[ArticleResponse] = []
        page = 1

        while page <= MAX_PAGES:
            paginated = await self._fetch_page(headers, page, user_id)
            all_articles = [*all_articles, *paginated.data]

            if not paginated.data or len(all_articles) >= paginated.total:
                break
            page += 1

        logger.info(
            "fetched_unread_articles",
            user_id=user_id,
            count=len(all_articles),
        )
        return all_articles

    async def get_recent_bookmarks(
        self, user_id: str, limit: int = 10
    ) -> list[BookmarkResponse]:
        """指定ユーザーの直近ブックマークを取得する。"""
        token = await self._token_manager.get_token()
        headers = {"Authorization": f"Bearer {token}"}
        url = f"{self._base_url}/bookmarks"
        params = {
            "user_id": user_id,
            "page": "1",
            "limit": str(limit),
        }

        try:
            response = await self._http_client.get(
                url, headers=headers, params=params
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(
                "bookmarks_request_failed",
                status=e.response.status_code,
                user_id=user_id,
            )
            raise FeedServiceError(
                f"Failed to fetch bookmarks: {e.response.status_code}"
            ) from e
        except httpx.HTTPError as e:
            logger.error("bookmarks_request_error", error=str(e))
            raise FeedServiceError(
                f"Failed to connect to feed service: {e}"
            ) from e

        result = PaginatedBookmarksResponse.model_validate(response.json())
        logger.info(
            "fetched_recent_bookmarks",
            user_id=user_id,
            count=len(result.data),
        )
        return result.data

    async def bulk_mark_as_read(
        self, user_id: str, article_ids: list[str]
    ) -> int:
        """指定記事を一括既読にする。"""
        if not article_ids:
            return 0

        token = await self._token_manager.get_token()
        headers = {"Authorization": f"Bearer {token}"}
        url = f"{self._base_url}/articles/bulk-read"
        params = {"user_id": user_id}
        payload = {"article_ids": article_ids}

        try:
            response = await self._http_client.patch(
                url, headers=headers, params=params, json=payload
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.warning(
                "bulk_read_request_failed",
                status=e.response.status_code,
                user_id=user_id,
            )
            return 0
        except httpx.HTTPError as e:
            logger.warning("bulk_read_request_error", error=str(e))
            return 0

        result = response.json()
        updated = result.get("updated_count", 0)
        logger.info(
            "bulk_marked_as_read",
            user_id=user_id,
            count=updated,
        )
        return updated

    async def _fetch_page(
        self, headers: dict[str, str], page: int, user_id: str
    ) -> PaginatedArticlesResponse:
        url = f"{self._base_url}/articles"
        params = {
            "is_read": "false",
            "page": str(page),
            "limit": str(self._page_size),
            "user_id": user_id,
        }

        try:
            response = await self._http_client.get(
                url, headers=headers, params=params
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(
                "feed_request_failed",
                status=e.response.status_code,
                page=page,
            )
            raise FeedServiceError(
                f"Failed to fetch articles: {e.response.status_code}"
            ) from e
        except httpx.HTTPError as e:
            logger.error("feed_request_error", error=str(e))
            raise FeedServiceError(
                f"Failed to connect to feed service: {e}"
            ) from e

        return PaginatedArticlesResponse.model_validate(response.json())
