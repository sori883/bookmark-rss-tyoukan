from typing import Any

from mcp.server.fastmcp import FastMCP

from .client import ApiClient

mcp = FastMCP("bookmark-rss")
_client = ApiClient()


@mcp.tool()
async def list_feeds() -> list[dict[str, Any]]:
    """フィード一覧を取得する。"""
    return await _client.list_feeds()


@mcp.tool()
async def list_articles(feed_id: str | None = None) -> dict[str, Any]:
    """RSS記事一覧を取得する。feed_idで絞り込み可能。"""
    return await _client.list_articles(feed_id=feed_id)


@mcp.tool()
async def get_article(id: str) -> dict[str, Any]:
    """RSS記事の詳細を取得する。"""
    return await _client.get_article(id)


@mcp.tool()
async def list_bookmarks() -> dict[str, Any]:
    """ブックマーク一覧を取得する。"""
    return await _client.list_bookmarks()


@mcp.tool()
async def get_bookmark(id: str) -> dict[str, Any]:
    """ブックマークの詳細（本文Markdownあり）を取得する。"""
    return await _client.get_bookmark(id)


@mcp.tool()
async def add_bookmark(url: str) -> dict[str, Any]:
    """URL指定でブックマークを追加する。"""
    return await _client.add_bookmark(url)


@mcp.tool()
async def remove_bookmark(id: str) -> str:
    """ブックマークを削除する。"""
    await _client.remove_bookmark(id)
    return "削除しました"


@mcp.tool()
async def search_bookmarks(query: str) -> dict[str, Any]:
    """ブックマークを全文検索する。"""
    return await _client.search_bookmarks(query)
