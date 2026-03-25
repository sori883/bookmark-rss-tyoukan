from datetime import datetime

from pydantic import BaseModel


class DigestRequest(BaseModel):
    since: datetime | None = None


class DigestArticle(BaseModel):
    url: str
    title: str
    summary: str


class DigestResponse(BaseModel):
    selected_count: int
    notified: bool
    articles: list[DigestArticle]


class ArticleResponse(BaseModel):
    id: str
    user_id: str
    feed_id: str
    url: str
    title: str
    is_read: bool
    published_at: datetime
    created_at: datetime
    updated_at: datetime


class PaginatedArticlesResponse(BaseModel):
    data: list[ArticleResponse]
    total: int
    page: int
    limit: int


class ServiceTokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int


class NotifyRequest(BaseModel):
    user_id: str
    message: str


class NotifyResponse(BaseModel):
    id: str
    webhook_sent: bool


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class NotificationTarget(BaseModel):
    user_id: str
    webhook_url: str
    webhook_type: str | None = None


class NotificationTargetsResponse(BaseModel):
    data: list[NotificationTarget]
