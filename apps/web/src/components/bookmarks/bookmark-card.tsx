import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import type { BookmarkResponse } from '~/types/api'
import { useDeleteBookmark } from '~/hooks/use-bookmarks'
import { Button } from '~/components/ui/button'
import { Modal } from '~/components/ui/modal'

type BookmarkCardProps = {
  readonly bookmark: BookmarkResponse
}

export function BookmarkCard({ bookmark }: BookmarkCardProps) {
  const deleteBookmark = useDeleteBookmark()
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowConfirm(true)
  }

  const handleConfirmDelete = () => {
    deleteBookmark.mutate(bookmark.id, {
      onSettled: () => setShowConfirm(false),
    })
  }

  return (
    <>
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
          <button
            type="button"
            onClick={handleDeleteClick}
            disabled={deleteBookmark.isPending}
            className="shrink-0 rounded-lg p-1.5 text-text-muted transition hover:bg-danger/10 hover:text-danger disabled:opacity-50"
            aria-label="ブックマークを削除"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </Link>

      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="ブックマークの削除"
      >
        <p className="mb-2 truncate text-sm font-medium">{bookmark.title}</p>
        <p className="mb-4 text-text-muted">このブックマークを削除しますか？</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowConfirm(false)}>
            キャンセル
          </Button>
          <Button
            variant="danger"
            loading={deleteBookmark.isPending}
            onClick={handleConfirmDelete}
          >
            削除する
          </Button>
        </div>
      </Modal>
    </>
  )
}
