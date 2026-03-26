import { CheckCircle, Circle } from 'lucide-react'
import { Link } from '@tanstack/react-router'
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

function extractTitle(message: string): string {
  const match = message.match(/^#\s+(.+)$/m)
  return match ? match[1] : '通知'
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
        {data.data.map((notification) => {
          const title = extractTitle(notification.message)

          return (
            <Link
              key={notification.id}
              to="/notifications/$id"
              params={{ id: notification.id }}
              className={`block rounded-lg bg-bg-card p-4 transition hover:bg-bg-hover ${
                !notification.is_read ? 'border-l-4 border-primary' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  {notification.is_read ? (
                    <CheckCircle size={20} className="text-text-muted" />
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        markRead.mutate(notification.id)
                      }}
                      className="text-primary transition hover:text-primary/70"
                      aria-label="既読にする"
                      title="既読にする"
                    >
                      <Circle size={20} />
                    </button>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{title}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
                    <span>{new Date(notification.sent_at).toLocaleString('ja-JP')}</span>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
      <Pagination
        page={data.page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  )
}
