import time
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from src.lib.auth import ServiceTokenManager
from src.lib.errors import AuthenticationError


class TestServiceTokenManager:
    async def test_fetches_token_on_first_call(
        self, token_manager: ServiceTokenManager, http_client: AsyncMock
    ) -> None:
        mock_response = AsyncMock(spec=httpx.Response)
        mock_response.json.return_value = {
            "access_token": "test-token",
            "token_type": "Bearer",
            "expires_in": 86400,
        }
        mock_response.raise_for_status = MagicMock()
        http_client.post.return_value = mock_response

        token = await token_manager.get_token()
        assert token == "test-token"
        http_client.post.assert_called_once()

    async def test_returns_cached_token(
        self, token_manager: ServiceTokenManager, http_client: AsyncMock
    ) -> None:
        mock_response = AsyncMock(spec=httpx.Response)
        mock_response.json.return_value = {
            "access_token": "cached-token",
            "token_type": "Bearer",
            "expires_in": 86400,
        }
        mock_response.raise_for_status = MagicMock()
        http_client.post.return_value = mock_response

        token1 = await token_manager.get_token()
        token2 = await token_manager.get_token()

        assert token1 == token2
        assert http_client.post.call_count == 1

    async def test_refetches_expired_token(
        self, token_manager: ServiceTokenManager, http_client: AsyncMock
    ) -> None:
        mock_response = AsyncMock(spec=httpx.Response)
        mock_response.json.return_value = {
            "access_token": "new-token",
            "token_type": "Bearer",
            "expires_in": 86400,
        }
        mock_response.raise_for_status = MagicMock()
        http_client.post.return_value = mock_response

        # Set expired token
        token_manager._cached_token = "old-token"
        token_manager._expires_at = time.time() - 1

        token = await token_manager.get_token()
        assert token == "new-token"
        http_client.post.assert_called_once()

    async def test_raises_on_auth_failure(
        self, token_manager: ServiceTokenManager, http_client: AsyncMock
    ) -> None:
        mock_response = AsyncMock(spec=httpx.Response)
        mock_response.status_code = 401
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Unauthorized", request=AsyncMock(), response=mock_response
        )
        http_client.post.return_value = mock_response

        with pytest.raises(AuthenticationError):
            await token_manager.get_token()

    async def test_raises_on_connection_error(
        self, token_manager: ServiceTokenManager, http_client: AsyncMock
    ) -> None:
        http_client.post.side_effect = httpx.ConnectError("Connection refused")

        with pytest.raises(AuthenticationError):
            await token_manager.get_token()
