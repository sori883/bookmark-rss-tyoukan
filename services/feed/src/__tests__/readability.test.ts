import { vi } from 'vitest'
import { extractContent } from '../lib/readability.js'

describe('extractContent', () => {
  it('should extract title and markdown from HTML', async () => {
    const html = `
      <html>
        <head><title>Test Article</title></head>
        <body>
          <article>
            <h1>Test Article</h1>
            <p>This is the main content of the article. It needs to be long enough for Readability to consider it as content. Here is some more text to make it substantial enough to parse correctly.</p>
            <p>Another paragraph with important information about the topic being discussed in this test article.</p>
          </article>
        </body>
      </html>
    `

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await extractContent('https://example.com/article')

    expect(result.title).toBeTruthy()
    expect(result.markdown).toContain('main content')

    vi.unstubAllGlobals()
  })

  it('should return empty for failed fetch', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await extractContent('https://example.com/404')

    expect(result.title).toBe('')
    expect(result.markdown).toBe('')

    vi.unstubAllGlobals()
  })
})
