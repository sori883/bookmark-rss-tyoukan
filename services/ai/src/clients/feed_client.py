import httpx
import structlog

from src.lib.auth import ServiceTokenManager
from src.lib.errors import FeedServiceError
from src.schemas import ArticleResponse, PaginatedArticlesResponse

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

    async def get_unread_articles(self) -> list[ArticleResponse]:
        token = await self._token_manager.get_token()
        headers = {"Authorization": f"Bearer {token}"}
        all_articles: list[ArticleResponse] = []
        page = 1

        while page <= MAX_PAGES:
            paginated = await self._fetch_page(headers, page)
            all_articles = [*all_articles, *paginated.data]

            if not paginated.data or len(all_articles) >= paginated.total:
                break
            page += 1

        logger.info("fetched_unread_articles", count=len(all_articles))
        return all_articles

    async def _fetch_page(
        self, headers: dict[str, str], page: int
    ) -> PaginatedArticlesResponse:
        url = f"{self._base_url}/articles"
        params = {
            "is_read": "false",
            "page": str(page),
            "limit": str(self._page_size),
        }

        try:
            response = await self._http_client.get(
                url, headers=headers, params=params
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error("feed_request_failed", status=e.response.status_code, page=page)
            raise FeedServiceError(
                f"Failed to fetch articles: {e.response.status_code}"
            ) from e
        except httpx.HTTPError as e:
            logger.error("feed_request_error", error=str(e))
            raise FeedServiceError(f"Failed to connect to feed service: {e}") from e

        return PaginatedArticlesResponse.model_validate(response.json())
