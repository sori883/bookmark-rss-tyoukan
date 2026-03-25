import { useState, useEffect } from 'react'
import { useSearchBookmarks } from '~/hooks/use-bookmarks'
import { BookmarkCard } from './bookmark-card'
import { Pagination } from '~/components/ui/pagination'
import { Loading } from '~/components/ui/loading'
import { ErrorMessage } from '~/components/ui/error-message'
import { EmptyState } from '~/components/ui/empty-state'
import { Input } from '~/components/ui/input'
import { DEFAULT_PAGE_SIZE, DEBOUNCE_MS } from '~/lib/constants'

type BookmarkSearchProps = {
  readonly initialQuery?: string
  readonly page?: number
  readonly onSearchChange: (q: string, page: number) => void
}

export function BookmarkSearch({
  initialQuery = '',
  page = 1,
  onSearchChange,
}: BookmarkSearchProps) {
  const [inputValue, setInputValue] = useState(initialQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue)
      if (inputValue !== initialQuery) {
        onSearchChange(inputValue, 1)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [inputValue, initialQuery, onSearchChange])

  const { data, isLoading, error, refetch } = useSearchBookmarks({
    q: debouncedQuery,
    page,
  })

  const totalPages = data
    ? Math.ceil(data.total / DEFAULT_PAGE_SIZE)
    : 0

  return (
    <div className="space-y-4">
      <Input
        type="search"
        placeholder="キーワードで検索..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />

      {!debouncedQuery ? (
        <EmptyState message="キーワードを入力して検索" />
      ) : isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorMessage message="検索に失敗しました" onRetry={() => refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState message="該当するブックマークがありません" />
      ) : (
        <>
          <p className="text-sm text-text-muted">{data.total}件の結果</p>
          <div className="space-y-2">
            {data.data.map((bookmark) => (
              <BookmarkCard key={bookmark.id} bookmark={bookmark} />
            ))}
          </div>
          <Pagination
            page={data.page}
            totalPages={totalPages}
            onPageChange={(p) => onSearchChange(debouncedQuery, p)}
          />
        </>
      )}
    </div>
  )
}
