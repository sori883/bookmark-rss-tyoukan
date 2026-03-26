import { BookmarkPlus, BookmarkCheck } from 'lucide-react'
import type { ArticleResponse } from '~/types/api'
import { useCreateBookmark } from '~/hooks/use-bookmarks'
import { useMarkArticleRead } from '~/hooks/use-articles'
import { Button } from '~/components/ui/button'

type ArticleCardProps = {
  readonly article: ArticleResponse
  readonly feedTitle?: string
}

export function ArticleCard({ article, feedTitle }: ArticleCardProps) {
  const createBookmark = useCreateBookmark()
  const markRead = useMarkArticleRead()

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation()
    createBookmark.mutate({ article_id: article.id })
  }

  const handleLinkClick = () => {
    if (!article.is_read) {
      markRead.mutate(article.id)
    }
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
            onClick={handleLinkClick}
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
        {article.is_bookmarked ? (
          <Button
            variant="ghost"
            size="sm"
            disabled
            aria-label="ブックマーク済み"
            title="ブックマーク済み"
          >
            <BookmarkCheck size={18} className="text-primary" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBookmark}
            loading={createBookmark.isPending}
            aria-label="ブックマークに追加"
            title="ブックマークに追加"
          >
            <BookmarkPlus size={18} />
          </Button>
        )}
      </div>
    </div>
  )
}
