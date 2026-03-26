from datetime import datetime

from pydantic import BaseModel


class DigestRequest(BaseModel):
    since: datetime | None = None
    skip_hour_filter: bool = False
    user_id: str | None = None


class DigestArticle(BaseModel):
    url: str
    title: str
    summary: str
    og_image_url: str | None = None


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
    description: str = ""
    og_image_url: str | None = None
    is_read: bool
    published_at: datetime | None = None
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


class BookmarkResponse(BaseModel):
    id: str
    user_id: str
    article_id: str | None = None
    url: str
    title: str
    content_markdown: str
    created_at: datetime
    updated_at: datetime


class PaginatedBookmarksResponse(BaseModel):
    data: list[BookmarkResponse]
    total: int
    page: int
    limit: int


class NotificationTarget(BaseModel):
    user_id: str
    webhook_url: str
    webhook_type: str | None = None
    notification_hour: int = 9


class NotificationTargetsResponse(BaseModel):
    data: list[NotificationTarget]
