import RssParser from 'rss-parser'
import { logger } from './logger.js'

const parser = new RssParser({
  timeout: 5_000,
  maxRedirects: 3,
})

const BLOCKED_HOSTNAME_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^localhost$/i,
  /^\[::1\]$/,
]

function isAllowedUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false
  }

  return !BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(parsed.hostname))
}

const COMMON_FEED_PATHS = [
  '/feed',
  '/rss',
  '/feed.xml',
  '/rss.xml',
  '/atom.xml',
  '/index.xml',
  '/feed/atom',
  '/feed/rss',
  '/.rss',
  '/blog/feed',
  '/blog/rss',
  '/blog/feed.xml',
] as const

/**
 * URLがRSSフィードかどうかを確認する。
 * パース成功すればフィードURLをそのまま返す。
 */
async function tryParseAsFeed(url: string): Promise<string | null> {
  if (!isAllowedUrl(url)) return null
  try {
    await parser.parseURL(url)
    return url
  } catch {
    return null
  }
}

/**
 * HTMLからRSSフィードURLを検出する。
 * <link rel="alternate" type="application/rss+xml"> や atom+xml を探す。
 */
function extractFeedLinksFromHtml(html: string, baseUrl: string): readonly string[] {
  const linkPattern =
    /<link[^>]+rel=["']alternate["'][^>]*>/gi
  const matches = html.match(linkPattern)
  if (!matches) return []

  const feedUrls: string[] = []

  for (const tag of matches) {
    const typeMatch = tag.match(/type=["']([^"']+)["']/)
    const hrefMatch = tag.match(/href=["']([^"']+)["']/)

    if (!typeMatch || !hrefMatch) continue

    const type = typeMatch[1]
    if (
      type.includes('rss+xml') ||
      type.includes('atom+xml') ||
      type.includes('rss') ||
      type.includes('atom')
    ) {
      try {
        const feedUrl = new URL(hrefMatch[1], baseUrl).href
        feedUrls.push(feedUrl)
      } catch {
        // 無効なURLはスキップ
      }
    }
  }

  return feedUrls
}

/**
 * URLからRSSフィードを自動検出する。
 *
 * 1. URLを直接RSSとしてパースを試みる
 * 2. HTMLとしてfetchし、<link> タグからフィードURLを検出
 * 3. よくあるRSSパスを試行
 * 4. 全て失敗 → null を返す
 */
export async function discoverFeedUrl(url: string): Promise<string | null> {
  if (!isAllowedUrl(url)) {
    logger.warn({ url }, 'URL blocked by SSRF protection')
    return null
  }

  // 1. 直接RSSパースを試行
  const directResult = await tryParseAsFeed(url)
  if (directResult) return directResult

  logger.info({ url }, 'URL is not a direct RSS feed, attempting discovery')

  // 2. HTMLをfetchして <link> タグからフィード検出
  let html: string
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BookmarkRSS/1.0 RSS Discovery' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      logger.warn({ url, status: response.status }, 'Failed to fetch URL for discovery')
      return null
    }
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return null
    }
    html = await response.text()
  } catch (err) {
    logger.warn({ url, err }, 'Failed to fetch URL for RSS discovery')
    return null
  }

  const feedLinks = extractFeedLinksFromHtml(html, url)
  for (const feedUrl of feedLinks) {
    const result = await tryParseAsFeed(feedUrl)
    if (result) {
      logger.info({ url, feedUrl }, 'RSS feed discovered via <link> tag')
      return result
    }
  }

  // 3. よくあるRSSパスを試行
  let origin: string
  try {
    origin = new URL(url).origin
  } catch {
    return null
  }

  for (const path of COMMON_FEED_PATHS) {
    const candidateUrl = `${origin}${path}`
    const result = await tryParseAsFeed(candidateUrl)
    if (result) {
      logger.info({ url, feedUrl: candidateUrl }, 'RSS feed discovered via common path')
      return result
    }
  }

  logger.info({ url }, 'No RSS feed found')
  return null
}
