import { createFileRoute, Link } from '@tanstack/react-router'
import { useBookmark } from '~/hooks/use-bookmarks'
import { MarkdownViewer } from '~/components/bookmarks/markdown-viewer'
import { Loading } from '~/components/ui/loading'
import { ErrorMessage } from '~/components/ui/error-message'
import { Button } from '~/components/ui/button'

export const Route = createFileRoute('/_authenticated/bookmarks/$id')({
  component: BookmarkDetailPage,
})

function BookmarkDetailPage() {
  const { id } = Route.useParams()
  const { data: bookmark, isLoading, error, refetch } = useBookmark(id)

  if (isLoading) return <Loading />
  if (error) return <ErrorMessage message="ブックマークの取得に失敗しました" onRetry={() => refetch()} />
  if (!bookmark) return <ErrorMessage message="ブックマークが見つかりません" />

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/bookmarks" search={{ tab: 'list', page: 1 }}>
          <Button variant="ghost" size="sm">
            ← 戻る
          </Button>
        </Link>
      </div>

      <div className="rounded-lg bg-bg-card p-6">
        <h1 className="mb-2 text-xl font-bold">{bookmark.title}</h1>
        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          {bookmark.url}
        </a>
        <p className="mt-1 text-xs text-text-muted">
          保存日: {new Date(bookmark.created_at).toLocaleDateString('ja-JP')}
        </p>

        <hr className="my-6 border-border" />

        <MarkdownViewer content={bookmark.content_markdown} />
      </div>
    </div>
  )
}
