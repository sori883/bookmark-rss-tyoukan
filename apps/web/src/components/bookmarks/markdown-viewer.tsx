import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

type MarkdownViewerProps = {
  readonly content: string
}

const components: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <img src={src} alt={alt ?? ''} loading="lazy" className="max-w-full rounded" />
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-lg bg-bg p-4 text-sm">{children}</pre>
  ),
  code: ({ children }) => (
    <code className="rounded bg-bg px-1.5 py-0.5 text-sm">{children}</code>
  ),
  h1: ({ children }) => <h1 className="mb-4 text-2xl font-bold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-3 text-xl font-bold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 text-lg font-bold">{children}</h3>,
  p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal pl-6">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-4 border-border pl-4 text-text-muted">
      {children}
    </blockquote>
  ),
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="prose-invert max-w-none">
      <ReactMarkdown components={components} rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
