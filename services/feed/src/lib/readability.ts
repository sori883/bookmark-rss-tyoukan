import { Readability } from '@mozilla/readability'
import TurndownService from 'turndown'
import { parseHTML } from 'linkedom'
import { logger } from './logger.js'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
})

export interface ExtractedContent {
  readonly title: string
  readonly markdown: string
}

export async function extractContent(url: string): Promise<ExtractedContent> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; BookmarkRSS/1.0; +https://github.com/bookmark-rss)',
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    logger.warn({ url, status: response.status }, 'Failed to fetch URL')
    return { title: '', markdown: '' }
  }

  const html = await response.text()
  const { document } = parseHTML(html)

  const article = new Readability(document).parse()

  if (!article) {
    logger.warn({ url }, 'Readability could not parse article')
    return { title: '', markdown: '' }
  }

  const markdown = turndown.turndown(article.content)

  return {
    title: article.title,
    markdown,
  }
}
