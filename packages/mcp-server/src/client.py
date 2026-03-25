from typing import Any

import httpx
import structlog

from .config import settings

logger = structlog.get_logger()


class ApiClientError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        super().__init__(message)


class ApiClient:
    def __init__(self, base_url: str = settings.api_url, token: str = settings.jwt_token) -> None:
        self._base_url = base_url
        self._token = token

    def _build_client(self) -> httpx.AsyncClient:
        headers: dict[str, str] = {}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        return httpx.AsyncClient(base_url=self._base_url, headers=headers)

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> Any:
        async with self._build_client() as client:
            response = await client.request(method, path, params=params, json=json)
            if response.status_code >= 400:
                body = response.text
                logger.error(
                    "api_request_failed",
                    method=method,
                    path=path,
                    status=response.status_code,
                    body=body,
                )
                raise ApiClientError(
                    response.status_code, f"API error {response.status_code}: {body}"
                )
            if response.status_code == 204:
                return None
            return response.json()

    async def list_feeds(self) -> list[dict[str, Any]]:
        return await self._request("GET", "/feeds")

    async def list_articles(self, feed_id: str | None = None) -> dict[str, Any]:
        params: dict[str, Any] = {}
        if feed_id is not None:
            params["feed_id"] = feed_id
        return await self._request("GET", "/articles", params=params)

    async def get_article(self, article_id: str) -> dict[str, Any]:
        return await self._request("GET", f"/articles/{article_id}")

    async def list_bookmarks(self) -> dict[str, Any]:
        return await self._request("GET", "/bookmarks")

    async def get_bookmark(self, bookmark_id: str) -> dict[str, Any]:
        return await self._request("GET", f"/bookmarks/{bookmark_id}")

    async def add_bookmark(self, url: str) -> dict[str, Any]:
        return await self._request("POST", "/bookmarks", json={"url": url})

    async def remove_bookmark(self, bookmark_id: str) -> None:
        await self._request("DELETE", f"/bookmarks/{bookmark_id}")

    async def search_bookmarks(self, query: str) -> dict[str, Any]:
        return await self._request("GET", "/bookmarks/search", params={"q": query})
