import { useState } from 'react'
import { useFeeds, useDeleteFeed } from '~/hooks/use-feeds'
import { Button } from '~/components/ui/button'
import { Modal } from '~/components/ui/modal'
import { Loading } from '~/components/ui/loading'
import { ErrorMessage } from '~/components/ui/error-message'
import { EmptyState } from '~/components/ui/empty-state'

export function FeedList() {
  const { data: feeds, isLoading, error, refetch } = useFeeds()
  const deleteFeed = useDeleteFeed()
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  if (isLoading) return <Loading />
  if (error) return <ErrorMessage message="フィードの取得に失敗しました" onRetry={() => refetch()} />
  if (!feeds || feeds.length === 0) {
    return <EmptyState message="フィードが登録されていません" />
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteFeed.mutate(deleteTarget, {
      onSettled: () => setDeleteTarget(null),
    })
  }

  return (
    <>
      <div className="space-y-2">
        {feeds.map((feed) => (
          <div
            key={feed.id}
            className="flex items-center justify-between rounded-lg bg-bg-card p-4"
          >
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-medium">{feed.title || feed.url}</h3>
              <p className="truncate text-sm text-text-muted">{feed.url}</p>
              {feed.last_fetched_at && (
                <p className="text-xs text-text-muted">
                  最終取得: {new Date(feed.last_fetched_at).toLocaleString('ja-JP')}
                </p>
              )}
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setDeleteTarget(feed.id)}
            >
              削除
            </Button>
          </div>
        ))}
      </div>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="フィードの削除"
      >
        <p className="mb-4 text-text-muted">このフィードを削除しますか？</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            キャンセル
          </Button>
          <Button
            variant="danger"
            loading={deleteFeed.isPending}
            onClick={handleDelete}
          >
            削除する
          </Button>
        </div>
      </Modal>
    </>
  )
}
