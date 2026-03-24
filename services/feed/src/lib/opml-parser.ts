import { parseHTML } from 'linkedom'

export interface OpmlFeed {
  readonly url: string
  readonly title: string
  readonly siteUrl: string
}

export function parseOpml(xml: string): readonly OpmlFeed[] {
  const { document } = parseHTML(xml)
  const outlines = document.querySelectorAll('outline')

  return Array.from(outlines)
    .filter((outline) => outline.getAttribute('xmlUrl'))
    .map((outline) => ({
      url: outline.getAttribute('xmlUrl') ?? '',
      title:
        outline.getAttribute('title') ??
        outline.getAttribute('text') ??
        '',
      siteUrl: outline.getAttribute('htmlUrl') ?? '',
    }))
}
