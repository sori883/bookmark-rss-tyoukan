import { Link } from '@tanstack/react-router'
import type { BookmarkResponse } from '~/types/api'
import { useDeleteBookmark } from '~/hooks/use-bookmarks'
import { Button } from '~/components/ui/button'

type BookmarkCardProps = {
  readonly bookmark: BookmarkResponse
}

export function BookmarkCard({ bookmark }: BookmarkCardProps) {
  const deleteBookmark = useDeleteBookmark()

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    deleteBookmark.mutate(bookmark.id)
  }

  return (
    <Link
      to="/bookmarks/$id"
      params={{ id: bookmark.id }}
      className="block rounded-lg bg-bg-card p-4 transition hover:bg-bg-hover"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium">{bookmark.title}</h3>
          <p className="truncate text-sm text-text-muted">{bookmark.url}</p>
          <p className="mt-1 text-xs text-text-muted">
            {new Date(bookmark.created_at).toLocaleDateString('ja-JP')}
          </p>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          loading={deleteBookmark.isPending}
          aria-label="ブックマークを削除"
        >
          削除
        </Button>
      </div>
    </Link>
  )
}
