import { parseOpml } from '../lib/opml-parser.js'

describe('parseOpml', () => {
  it('should parse feeds from OPML', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Feeds</title></head>
  <body>
    <outline text="Tech" title="Tech">
      <outline text="Blog A" title="Blog A" xmlUrl="https://a.com/rss" htmlUrl="https://a.com" />
      <outline text="Blog B" title="Blog B" xmlUrl="https://b.com/feed" htmlUrl="https://b.com" />
    </outline>
    <outline text="News" xmlUrl="https://news.com/rss" htmlUrl="https://news.com" />
  </body>
</opml>`

    const feeds = parseOpml(xml)

    expect(feeds).toHaveLength(3)
    expect(feeds[0]).toEqual({
      url: 'https://a.com/rss',
      title: 'Blog A',
      siteUrl: 'https://a.com',
    })
    expect(feeds[2]).toEqual({
      url: 'https://news.com/rss',
      title: 'News',
      siteUrl: 'https://news.com',
    })
  })

  it('should return empty array for OPML with no feeds', () => {
    const xml = `<?xml version="1.0"?><opml><body></body></opml>`
    const feeds = parseOpml(xml)
    expect(feeds).toHaveLength(0)
  })

  it('should use text attribute as fallback for title', () => {
    const xml = `<opml><body>
      <outline text="Fallback Title" xmlUrl="https://x.com/rss" />
    </body></opml>`

    const feeds = parseOpml(xml)
    expect(feeds[0].title).toBe('Fallback Title')
  })
})
