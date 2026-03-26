import asyncio
import re

import httpx
import structlog

logger = structlog.get_logger(__name__)

OGP_TIMEOUT = 5.0
OG_IMAGE_PATTERN = re.compile(
    r'<meta\s+[^>]*property=["\']og:image["\']\s+[^>]*content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
OG_IMAGE_PATTERN_REVERSED = re.compile(
    r'<meta\s+[^>]*content=["\']([^"\']+)["\']\s+[^>]*property=["\']og:image["\']',
    re.IGNORECASE,
)


async def fetch_og_image(url: str) -> str | None:
    """記事URLからog:image URLを取得する。失敗時はNone。"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                timeout=OGP_TIMEOUT,
                follow_redirects=True,
                headers={"User-Agent": "BookmarkRSS/1.0"},
            )
            if response.status_code != 200:
                return None

            # HEADだけ読めば十分（og:imageは通常<head>内）
            html = response.text[:10000]

            match = OG_IMAGE_PATTERN.search(html)
            if match:
                return match.group(1)

            match = OG_IMAGE_PATTERN_REVERSED.search(html)
            if match:
                return match.group(1)

    except Exception:
        logger.debug("og_image_fetch_failed", url=url)

    return None


async def fetch_og_images(
    urls: list[str],
) -> dict[str, str | None]:
    """複数URLのog:imageを並列取得する。"""
    tasks = [fetch_og_image(url) for url in urls]
    results = await asyncio.gather(*tasks)

    url_to_image: dict[str, str | None] = {}
    for url, image in zip(urls, results):
        url_to_image[url] = image

    found = sum(1 for v in url_to_image.values() if v)
    logger.info(
        "og_images_fetched",
        total=len(urls),
        found=found,
    )
    return url_to_image
