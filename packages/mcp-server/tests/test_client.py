import json
from typing import Any

import httpx
import pytest

from src.client import BffClient, BffClientError

FAKE_TOKEN = "test-jwt-token"
BASE_URL = "http://bff-test:3010"


def make_transport(
    *,
    status: int = 200,
    body: Any = None,
    expect_method: str | None = None,
    expect_path: str | None = None,
    expect_query: dict[str, str] | None = None,
    expect_json: dict[str, Any] | None = None,
) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers.get("Authorization") == f"Bearer {FAKE_TOKEN}"

        if expect_method is not None:
            assert request.method == expect_method

        if expect_path is not None:
            assert request.url.path == expect_path

        if expect_query is not None:
            for key, value in expect_query.items():
                assert request.url.params.get(key) == value

        if expect_json is not None:
            req_body = json.loads(request.content)
            assert req_body == expect_json

        if status == 204:
            return httpx.Response(status_code=204)
        return httpx.Response(status_code=status, json=body)

    return httpx.MockTransport(handler)


def make_client(transport: httpx.MockTransport) -> BffClient:
    client = BffClient(base_url=BASE_URL, token=FAKE_TOKEN)

    original_build = client._build_client

    def patched_build() -> httpx.AsyncClient:
        c = original_build()
        c._transport = transport  # type: ignore[assignment]
        return c

    client._build_client = patched_build  # type: ignore[assignment]
    return client


FEED_RESPONSE = [
    {
        "id": "feed-1",
        "user_id": "user-1",
        "url": "https://example.com/feed.xml",
        "title": "Example Feed",
        "site_url": "https://example.com",
        "last_fetched_at": None,
        "created_at": "2025-01-01T00:00:00Z",
    }
]

ARTICLE_RESPONSE = {
    "data": [
        {
            "id": "article-1",
            "user_id": "user-1",
            "feed_id": "feed-1",
            "url": "https://example.com/article-1",
            "title": "Article 1",
            "is_read": False,
            "published_at": "2025-01-01T00:00:00Z",
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-01-01T00:00:00Z",
        }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
}

BOOKMARK_RESPONSE = {
    "data": [
        {
            "id": "bm-1",
            "user_id": "user-1",
            "article_id": None,
            "url": "https://example.com/page",
            "title": "Example Page",
            "content_markdown": "# Hello",
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-01-01T00:00:00Z",
        }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
}

BOOKMARK_DETAIL = BOOKMARK_RESPONSE["data"][0]


@pytest.mark.asyncio
async def test_list_feeds() -> None:
    transport = make_transport(
        body=FEED_RESPONSE,
        expect_method="GET",
        expect_path="/feeds",
    )
    client = make_client(transport)
    result = await client.list_feeds()
    assert result == FEED_RESPONSE


@pytest.mark.asyncio
async def test_list_articles() -> None:
    transport = make_transport(
        body=ARTICLE_RESPONSE,
        expect_method="GET",
        expect_path="/articles",
    )
    client = make_client(transport)
    result = await client.list_articles()
    assert result == ARTICLE_RESPONSE


@pytest.mark.asyncio
async def test_list_articles_with_feed_id() -> None:
    transport = make_transport(
        body=ARTICLE_RESPONSE,
        expect_method="GET",
        expect_path="/articles",
        expect_query={"feed_id": "feed-1"},
    )
    client = make_client(transport)
    result = await client.list_articles(feed_id="feed-1")
    assert result == ARTICLE_RESPONSE


@pytest.mark.asyncio
async def test_get_article() -> None:
    article = ARTICLE_RESPONSE["data"][0]
    transport = make_transport(
        body=article,
        expect_method="GET",
        expect_path="/articles/article-1",
    )
    client = make_client(transport)
    result = await client.get_article("article-1")
    assert result == article


@pytest.mark.asyncio
async def test_list_bookmarks() -> None:
    transport = make_transport(
        body=BOOKMARK_RESPONSE,
        expect_method="GET",
        expect_path="/bookmarks",
    )
    client = make_client(transport)
    result = await client.list_bookmarks()
    assert result == BOOKMARK_RESPONSE


@pytest.mark.asyncio
async def test_get_bookmark() -> None:
    transport = make_transport(
        body=BOOKMARK_DETAIL,
        expect_method="GET",
        expect_path="/bookmarks/bm-1",
    )
    client = make_client(transport)
    result = await client.get_bookmark("bm-1")
    assert result == BOOKMARK_DETAIL


@pytest.mark.asyncio
async def test_add_bookmark() -> None:
    transport = make_transport(
        status=201,
        body=BOOKMARK_DETAIL,
        expect_method="POST",
        expect_path="/bookmarks",
        expect_json={"url": "https://example.com/page"},
    )
    client = make_client(transport)
    result = await client.add_bookmark("https://example.com/page")
    assert result == BOOKMARK_DETAIL


@pytest.mark.asyncio
async def test_remove_bookmark() -> None:
    transport = make_transport(
        status=204,
        expect_method="DELETE",
        expect_path="/bookmarks/bm-1",
    )
    client = make_client(transport)
    result = await client.remove_bookmark("bm-1")
    assert result is None


@pytest.mark.asyncio
async def test_search_bookmarks() -> None:
    transport = make_transport(
        body=BOOKMARK_RESPONSE,
        expect_method="GET",
        expect_path="/bookmarks/search",
        expect_query={"q": "hello"},
    )
    client = make_client(transport)
    result = await client.search_bookmarks("hello")
    assert result == BOOKMARK_RESPONSE


@pytest.mark.asyncio
async def test_error_handling() -> None:
    transport = make_transport(
        status=404, body={"error": {"code": "NOT_FOUND", "message": "not found"}}
    )
    client = make_client(transport)
    with pytest.raises(BffClientError) as exc_info:
        await client.list_feeds()
    assert exc_info.value.status_code == 404
