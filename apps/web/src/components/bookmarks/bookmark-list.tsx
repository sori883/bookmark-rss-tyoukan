import type { PaginationParams } from '~/types/api'
import { useBookmarks } from '~/hooks/use-bookmarks'
import { BookmarkCard } from './bookmark-card'
import { Pagination } from '~/components/ui/pagination'
import { Loading } from '~/components/ui/loading'
import { ErrorMessage } from '~/components/ui/error-message'
import { EmptyState } from '~/components/ui/empty-state'
import { DEFAULT_PAGE_SIZE } from '~/lib/constants'

type BookmarkListProps = {
  readonly params: PaginationParams
  readonly onPageChange: (page: number) => void
}

export function BookmarkList({ params, onPageChange }: BookmarkListProps) {
  const { data, isLoading, error, refetch } = useBookmarks(params)

  if (isLoading) return <Loading />
  if (error) return <ErrorMessage message="ブックマークの取得に失敗しました" onRetry={() => refetch()} />
  if (!data || data.data.length === 0) {
    return <EmptyState message="ブックマークがありません" />
  }

  const totalPages = Math.ceil(data.total / (params.limit ?? DEFAULT_PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {data.data.map((bookmark) => (
          <BookmarkCard key={bookmark.id} bookmark={bookmark} />
        ))}
      </div>
      <Pagination
        page={data.page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  )
}
