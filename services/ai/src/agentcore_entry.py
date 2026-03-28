"""AgentCore Runtime 用エントリポイント。

ローカルでは FastAPI (main.py) を使い、AWS では BedrockAgentCoreApp を使う。
コアロジック (execute_digest) は共通。
"""

import asyncio
import json

import httpx
import structlog
from bedrock_agentcore.runtime import BedrockAgentCoreApp

from src.clients.feed_client import FeedClient
from src.clients.notification_client import NotificationClient
from src.config import get_settings
from src.lib.auth import ServiceTokenManager
from src.lib.logger import setup_logging
from src.routes.digest import execute_digest
from src.schemas import DigestRequest

setup_logging()
logger = structlog.get_logger(__name__)

app = BedrockAgentCoreApp()


@app.entrypoint
async def invoke(payload: dict) -> str:
    settings = get_settings()

    async with httpx.AsyncClient(timeout=30.0) as http_client:
        token_manager = ServiceTokenManager(
            http_client=http_client,
            auth_service_url=settings.auth_service_url,
            client_id=settings.ai_client_id,
            client_secret=settings.ai_client_secret,
            cache_margin_seconds=settings.jwt_cache_margin_seconds,
        )

        feed_client = FeedClient(
            http_client=http_client,
            base_url=settings.feed_service_url,
            token_manager=token_manager,
            page_size=settings.max_articles_per_request,
        )

        notification_client = NotificationClient(
            http_client=http_client,
            base_url=settings.notification_service_url,
            token_manager=token_manager,
        )

        body = DigestRequest(**payload)
        result = await execute_digest(feed_client, notification_client, body)

    return json.dumps(result.model_dump(), default=str)


if __name__ == "__main__":
    app.run()
