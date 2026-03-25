import type { ArticleResponse } from '~/types/api'
import { useCreateBookmark } from '~/hooks/use-bookmarks'
import { Button } from '~/components/ui/button'

type ArticleCardProps = {
  readonly article: ArticleResponse
  readonly feedTitle?: string
}

export function ArticleCard({ article, feedTitle }: ArticleCardProps) {
  const createBookmark = useCreateBookmark()

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation()
    createBookmark.mutate({ article_id: article.id })
  }

  return (
    <div
      className={`rounded-lg bg-bg-card p-4 transition hover:bg-bg-hover ${
        article.is_read ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:text-primary"
          >
            {article.title}
          </a>
          <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
            {feedTitle && <span>{feedTitle}</span>}
            <span>{new Date(article.published_at).toLocaleDateString('ja-JP')}</span>
            {!article.is_read && (
              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-primary">
                未読
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBookmark}
          loading={createBookmark.isPending}
          aria-label="ブックマークに追加"
        >
          🔖
        </Button>
      </div>
    </div>
  )
}
