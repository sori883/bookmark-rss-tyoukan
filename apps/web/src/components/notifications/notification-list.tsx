import type { PaginationParams } from '~/types/api'
import { useNotifications, useMarkNotificationRead } from '~/hooks/use-notifications'
import { Pagination } from '~/components/ui/pagination'
import { Loading } from '~/components/ui/loading'
import { ErrorMessage } from '~/components/ui/error-message'
import { EmptyState } from '~/components/ui/empty-state'
import { DEFAULT_PAGE_SIZE } from '~/lib/constants'

type NotificationListProps = {
  readonly params: PaginationParams
  readonly onPageChange: (page: number) => void
}

export function NotificationList({ params, onPageChange }: NotificationListProps) {
  const { data, isLoading, error, refetch } = useNotifications(params)
  const markRead = useMarkNotificationRead()

  if (isLoading) return <Loading />
  if (error) return <ErrorMessage message="通知の取得に失敗しました" onRetry={() => refetch()} />
  if (!data || data.data.length === 0) {
    return <EmptyState message="通知がありません" />
  }

  const totalPages = Math.ceil(data.total / (params.limit ?? DEFAULT_PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {data.data.map((notification) => (
          <div
            key={notification.id}
            className={`rounded-lg bg-bg-card p-4 ${
              !notification.is_read ? 'border-l-4 border-primary' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                  {notification.message}
                </pre>
                <p className="mt-2 text-xs text-text-muted">
                  {new Date(notification.sent_at).toLocaleString('ja-JP')}
                </p>
              </div>
              {!notification.is_read && (
                <button
                  type="button"
                  onClick={() => markRead.mutate(notification.id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs text-text-muted transition hover:bg-bg-hover"
                >
                  既読にする
                </button>
              )}
            </div>
          </div>
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
