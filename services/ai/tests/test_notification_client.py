from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from src.clients.notification_client import NotificationClient
from src.lib.auth import ServiceTokenManager
from src.lib.errors import NotificationServiceError


@pytest.fixture
def notification_client(
    http_client: AsyncMock, token_manager: ServiceTokenManager
) -> NotificationClient:
    token_manager._cached_token = "test-token"
    token_manager._expires_at = float("inf")
    return NotificationClient(
        http_client=http_client,
        base_url="http://notification:3004",
        token_manager=token_manager,
    )


class TestNotificationClient:
    async def test_send_digest_success(
        self, notification_client: NotificationClient, http_client: AsyncMock
    ) -> None:
        mock_response = AsyncMock(spec=httpx.Response)
        mock_response.json.return_value = {
            "id": "notif-1",
            "webhook_sent": True,
        }
        mock_response.raise_for_status = MagicMock()
        http_client.post.return_value = mock_response

        result = await notification_client.send_digest(
            user_id="user-1", message="Test digest"
        )
        assert result.id == "notif-1"
        assert result.webhook_sent is True

    async def test_raises_on_notification_error(
        self, notification_client: NotificationClient, http_client: AsyncMock
    ) -> None:
        mock_response = AsyncMock(spec=httpx.Response)
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Internal Server Error", request=AsyncMock(), response=mock_response
        )
        http_client.post.return_value = mock_response

        with pytest.raises(NotificationServiceError):
            await notification_client.send_digest(
                user_id="user-1", message="Test digest"
            )
