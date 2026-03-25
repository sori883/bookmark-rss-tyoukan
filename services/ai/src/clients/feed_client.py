import httpx
import structlog

from src.lib.auth import ServiceTokenManager
from src.lib.errors import FeedServiceError
from src.schemas import (
    ArticleResponse,
    NotificationTarget,
    NotificationTargetsResponse,
    PaginatedArticlesResponse,
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
        self._base_url = base_url
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
