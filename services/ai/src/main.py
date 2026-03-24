from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from src.clients.feed_client import FeedClient
from src.clients.notification_client import NotificationClient
from src.config import get_settings
from src.lib.auth import ServiceTokenManager
from src.lib.errors import (
    AuthenticationError,
    FeedServiceError,
    NotificationServiceError,
)
from src.lib.logger import setup_logging
from src.routes.digest import router as digest_router

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    setup_logging()

    async with httpx.AsyncClient(timeout=30.0) as http_client:
        token_manager = ServiceTokenManager(
            http_client=http_client,
            auth_service_url=settings.auth_service_url,
            client_id=settings.ai_client_id,
            client_secret=settings.ai_client_secret,
            cache_margin_seconds=settings.jwt_cache_margin_seconds,
        )

        app.state.feed_client = FeedClient(
            http_client=http_client,
            base_url=settings.feed_service_url,
            token_manager=token_manager,
            page_size=settings.max_articles_per_request,
        )

        app.state.notification_client = NotificationClient(
            http_client=http_client,
            base_url=settings.notification_service_url,
            token_manager=token_manager,
        )

        logger.info("app_started")
        yield
        logger.info("app_stopped")


app = FastAPI(title="AI Service", version="0.0.1", lifespan=lifespan)
app.include_router(digest_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.exception_handler(AuthenticationError)
async def auth_error_handler(request: Request, exc: AuthenticationError) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"error": {"code": "AUTH_SERVICE_ERROR", "message": str(exc)}},
    )


@app.exception_handler(FeedServiceError)
async def feed_error_handler(request: Request, exc: FeedServiceError) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"error": {"code": "FEED_SERVICE_ERROR", "message": str(exc)}},
    )


@app.exception_handler(NotificationServiceError)
async def notification_error_handler(
    request: Request, exc: NotificationServiceError
) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={"error": {"code": "NOTIFICATION_SERVICE_ERROR", "message": str(exc)}},
    )
