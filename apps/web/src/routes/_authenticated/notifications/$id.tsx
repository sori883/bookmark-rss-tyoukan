import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useNotifications, useMarkNotificationRead } from '~/hooks/use-notifications'
import { DigestCardList } from '~/components/notifications/digest-card-list'
import { MarkdownViewer } from '~/components/bookmarks/markdown-viewer'
import { Loading } from '~/components/ui/loading'
import { ErrorMessage } from '~/components/ui/error-message'

export const Route = createFileRoute('/_authenticated/notifications/$id')({
  component: NotificationDetailPage,
})

function NotificationDetailPage() {
  const { id } = Route.useParams()
  const { data, isLoading, error, refetch } = useNotifications({ limit: 100 })
  const markRead = useMarkNotificationRead()

  const notification = data?.data.find((n) => n.id === id)

  useEffect(() => {
    if (notification && !notification.is_read) {
      markRead.mutate(notification.id)
    }
  }, [notification?.id, notification?.is_read])

  if (isLoading) return <Loading />
  if (error) return <ErrorMessage message="通知の取得に失敗しました" onRetry={() => refetch()} />
  if (!notification) {
    return <ErrorMessage message="通知が見つかりませんでした" />
  }

  const isDigest = notification.message.includes('# 本日のダイジェスト')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">通知詳細</h1>
        <span className="text-sm text-text-muted">
          {new Date(notification.sent_at).toLocaleString('ja-JP')}
        </span>
      </div>
      {isDigest ? (
        <DigestCardList content={notification.message} />
      ) : (
        <div className="rounded-lg bg-bg-card p-4">
          <MarkdownViewer content={notification.message} />
        </div>
      )}
    </div>
  )
}
