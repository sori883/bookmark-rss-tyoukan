import httpx
import structlog

from src.lib.auth import ServiceTokenManager
from src.lib.errors import NotificationServiceError
from src.schemas import NotifyResponse

logger = structlog.get_logger(__name__)


class NotificationClient:
    """notification サービスにダイジェスト通知を送信する HTTP クライアント。"""

    def __init__(
        self,
        http_client: httpx.AsyncClient,
        base_url: str,
        token_manager: ServiceTokenManager,
    ) -> None:
        self._http_client = http_client
        self._base_url = base_url.rstrip('/')
        self._token_manager = token_manager

    async def send_digest(
        self,
        user_id: str,
        message: str,
        webhook_message: str | None = None,
    ) -> NotifyResponse:
        token = await self._token_manager.get_token()
        headers = {"Authorization": f"Bearer {token}"}
        url = f"{self._base_url}/notify"
        payload: dict[str, str] = {"user_id": user_id, "message": message}
        if webhook_message is not None:
            payload["webhook_message"] = webhook_message

        try:
            response = await self._http_client.post(
                url, headers=headers, json=payload
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(
                "notification_request_failed",
                status=e.response.status_code,
                user_id=user_id,
            )
            raise NotificationServiceError(
                f"Failed to send notification: {e.response.status_code}"
            ) from e
        except httpx.HTTPError as e:
            logger.error("notification_request_error", error=str(e))
            raise NotificationServiceError(
                f"Failed to connect to notification service: {e}"
            ) from e

        logger.info("notification_sent", user_id=user_id)
        return NotifyResponse.model_validate(response.json())
