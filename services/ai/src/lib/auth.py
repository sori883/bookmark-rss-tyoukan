import asyncio
import time

import httpx
import structlog

from src.lib.errors import AuthenticationError
from src.schemas import ServiceTokenResponse

logger = structlog.get_logger(__name__)


class ServiceTokenManager:
    """auth サービスからサービスJWTを取得・キャッシュする。"""

    def __init__(
        self,
        http_client: httpx.AsyncClient,
        auth_service_url: str,
        client_id: str,
        client_secret: str,
        cache_margin_seconds: int = 300,
    ) -> None:
        self._http_client = http_client
        self._auth_service_url = auth_service_url.rstrip('/')
        self._client_id = client_id
        self._client_secret = client_secret
        self._cache_margin_seconds = cache_margin_seconds
        self._cached_token: str | None = None
        self._expires_at: float | None = None
        self._lock = asyncio.Lock()

    async def get_token(self) -> str:
        async with self._lock:
            if self._is_token_valid():
                return self._cached_token  # type: ignore[return-value]

            return await self._fetch_token()

    def _is_token_valid(self) -> bool:
        if self._cached_token is None or self._expires_at is None:
            return False
        return time.time() < (self._expires_at - self._cache_margin_seconds)

    async def _fetch_token(self) -> str:
        url = f"{self._auth_service_url}/auth/service-token"
        payload = {
            "client_id": self._client_id,
            "client_secret": self._client_secret,
        }

        try:
            response = await self._http_client.post(url, json=payload)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error("service_token_request_failed", status=e.response.status_code)
            raise AuthenticationError(
                f"Failed to obtain service token: {e.response.status_code}"
            ) from e
        except httpx.HTTPError as e:
            logger.error("service_token_request_error", error=str(e))
            raise AuthenticationError(f"Failed to connect to auth service: {e}") from e

        token_response = ServiceTokenResponse.model_validate(response.json())
        self._cached_token = token_response.access_token
        self._expires_at = time.time() + token_response.expires_in

        logger.info("service_token_acquired", expires_in=token_response.expires_in)
        return self._cached_token
