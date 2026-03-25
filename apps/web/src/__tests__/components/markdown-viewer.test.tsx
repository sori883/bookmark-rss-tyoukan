import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownViewer } from '~/components/bookmarks/markdown-viewer'

describe('MarkdownViewer', () => {
  it('should render markdown content', () => {
    render(<MarkdownViewer content="# Hello World" />)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('should render links with target="_blank"', () => {
    render(<MarkdownViewer content="[Example](https://example.com)" />)
    const link = screen.getByText('Example')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('should render code blocks', () => {
    const md = ['```', 'const x = 1', '```'].join('\n')
    render(<MarkdownViewer content={md} />)
    expect(screen.getByText('const x = 1')).toBeInTheDocument()
  })

  it('should render lists', () => {
    const md = ['- Item 1', '- Item 2'].join('\n')
    render(<MarkdownViewer content={md} />)
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
  })

  it('should render images with lazy loading', () => {
    render(<MarkdownViewer content="![alt text](https://example.com/image.png)" />)
    const img = screen.getByAltText('alt text')
    expect(img).toHaveAttribute('loading', 'lazy')
  })
})
