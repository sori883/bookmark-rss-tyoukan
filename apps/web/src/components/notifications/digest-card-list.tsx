import { useMemo, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BookmarkPlus, BookmarkCheck, ExternalLink, Circle, CheckCircle } from 'lucide-react'
import { apiClient } from '~/lib/api-client'
import { useBookmarks, useCreateBookmark } from '~/hooks/use-bookmarks'

type DigestArticle = {
  readonly title: string
  readonly imageUrl: string | null
  readonly summary: string
  readonly articleUrl: string | null
}

function parseDigestMarkdown(markdown: string): {
  heading: string
  articles: readonly DigestArticle[]
} {
  const headingMatch = markdown.match(/^#\s+(.+)$/m)
  const heading = headingMatch ? headingMatch[1] : 'ダイジェスト'

  // ## 見出しで分割して各記事ブロックを抽出
  const blocks = markdown.split(/(?=^## )/m).filter((s) => s.match(/^## /))
  const articles: DigestArticle[] = []

  for (const block of blocks) {
    const titleMatch = block.match(/^##\s+(.+)$/m)
    if (!titleMatch) continue

    const title = titleMatch[1]

    const imageMatch = block.match(/!\[.*?\]\((.+?)\)/)
    const imageUrl = imageMatch ? imageMatch[1] : null

    const linkMatch = block.match(/\[記事を読む\]\((.+?)\)/)
    const articleUrl = linkMatch ? linkMatch[1] : null

    const summary = block
      .replace(/^##\s+.+$/m, '')
      .replace(/!\[.*?\]\(.+?\)/, '')
      .replace(/\[記事を読む\]\(.+?\)(\s*\|\s*\[ブックマーク\]\(.+?\))?/, '')
      .replace(/---/g, '')
      .trim()

    articles.push({ title, imageUrl, summary, articleUrl })
  }

  return { heading, articles }
}

type DigestCardListProps = {
  readonly content: string
}

export function DigestCardList({ content }: DigestCardListProps) {
  const { heading, articles } = useMemo(
    () => parseDigestMarkdown(content),
    [content],
  )

  const queryClient = useQueryClient()
  const { data: bookmarksData } = useBookmarks({ limit: 100 })
  const createBookmark = useCreateBookmark()

  // ローカルで既読・ブックマーク済み状態を管理
  const [readUrls, setReadUrls] = useState<Set<string>>(new Set())
  const [bookmarkedUrls, setBookmarkedUrls] = useState<Set<string>>(new Set())

  // ブックマーク一覧からURLセットを作成
  const dbBookmarkedUrls = useMemo(() => {
    const set = new Set<string>()
    if (bookmarksData?.data) {
      for (const b of bookmarksData.data) {
        set.add(b.url)
      }
    }
    return set
  }, [bookmarksData])

  const handleReadClick = useCallback(
    (url: string) => {
      setReadUrls((prev) => new Set([...prev, url]))
      apiClient.markArticleReadByUrl(url).then(() => {
        queryClient.invalidateQueries({ queryKey: ['articles'] })
      })
    },
    [queryClient],
  )

  const handleBookmark = useCallback(
    (url: string) => {
      setBookmarkedUrls((prev) => new Set([...prev, url]))
      createBookmark.mutate({ url })
    },
    [createBookmark],
  )

  if (articles.length === 0) {
    return (
      <p className="text-sm text-text-muted">記事が見つかりませんでした</p>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{heading}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {articles.map((article) => {
          const url = article.articleUrl ?? ''
          const isRead = readUrls.has(url)
          const isBookmarked =
            dbBookmarkedUrls.has(url) || bookmarkedUrls.has(url)

          return (
            <div
              key={url || article.title}
              className={`flex flex-col overflow-hidden rounded-lg border border-border bg-bg-card ${
                isRead ? 'opacity-60' : ''
              }`}
            >
              {article.imageUrl && (
                <div className="aspect-video w-full overflow-hidden bg-bg-hover">
                  <img
                    src={article.imageUrl}
                    alt={article.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col p-3">
                <div className="flex items-start gap-1.5">
                  <div className="shrink-0 pt-0.5">
                    {isRead ? (
                      <CheckCircle size={14} className="text-text-muted" />
                    ) : (
                      <Circle size={14} className="text-primary" />
                    )}
                  </div>
                  <h3 className="text-sm font-semibold leading-snug">
                    {article.title}
                  </h3>
                </div>
                <p className="mt-1.5 flex-1 text-xs leading-relaxed text-text-muted">
                  {article.summary}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  {article.articleUrl && (
                    <a
                      href={article.articleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-medium text-white transition hover:bg-primary/80"
                      onClick={() => handleReadClick(article.articleUrl!)}
                    >
                      <ExternalLink size={12} />
                      読む
                    </a>
                  )}
                  {isBookmarked ? (
                    <span className="inline-flex items-center gap-1 rounded border border-primary/30 px-2.5 py-1 text-xs font-medium text-primary">
                      <BookmarkCheck size={12} />
                      保存済み
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleBookmark(url)}
                      disabled={!article.articleUrl}
                      className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-xs font-medium text-text-muted transition hover:bg-bg-hover disabled:opacity-50"
                    >
                      <BookmarkPlus size={12} />
                      保存
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
