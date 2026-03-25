import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { BookmarkPlus, CheckCircle, AlertCircle } from 'lucide-react'
import { useCreateBookmark } from '~/hooks/use-bookmarks'
import { Loading } from '~/components/ui/loading'

const searchSchema = z.object({
  url: z.string(),
})

export const Route = createFileRoute('/_authenticated/bookmark-add')({
  validateSearch: (search) => searchSchema.parse(search),
  component: BookmarkAddPage,
})

function BookmarkAddPage() {
  const { url } = Route.useSearch()
  const createBookmark = useCreateBookmark()
  const [triggered, setTriggered] = useState(false)

  useEffect(() => {
    if (url && !triggered) {
      setTriggered(true)
      createBookmark.mutate({ url })
    }
  }, [url, triggered, createBookmark])

  if (createBookmark.isPending || !triggered) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Loading />
        <p className="text-text-muted">ブックマークを登録しています...</p>
      </div>
    )
  }

  if (createBookmark.isError) {
    const isDuplicate = 'code' in createBookmark.error && createBookmark.error.code === 'DUPLICATE'

    if (isDuplicate) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <CheckCircle size={48} className="text-primary" />
          <h2 className="text-lg font-bold">既にブックマーク済みです</h2>
          <p className="max-w-md truncate text-sm text-text-muted">{url}</p>
          <Link
            to="/bookmarks" search={{ tab: 'list', page: 1 }}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primary-dark"
          >
            ブックマーク一覧へ
          </Link>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <AlertCircle size={48} className="text-danger" />
        <h2 className="text-lg font-bold">登録に失敗しました</h2>
        <p className="text-sm text-text-muted">{createBookmark.error.message}</p>
        <p className="max-w-md truncate text-xs text-text-muted">{url}</p>
        <Link
          to="/bookmarks" search={{ tab: 'list', page: 1 }}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primary-dark"
        >
          ブックマーク一覧へ
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <CheckCircle size={48} className="text-success" />
      <h2 className="text-lg font-bold">ブックマークに追加しました</h2>
      <p className="max-w-md truncate text-sm text-text-muted">{createBookmark.data?.title}</p>
      <div className="flex gap-3">
        {createBookmark.data && (
          <Link
            to="/bookmarks/$id"
            params={{ id: createBookmark.data.id }}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primary-dark"
          >
            <span className="flex items-center gap-1.5">
              <BookmarkPlus size={16} />
              本文を読む
            </span>
          </Link>
        )}
        <Link
          to="/bookmarks" search={{ tab: 'list', page: 1 }}
          className="rounded-lg bg-bg-hover px-4 py-2 text-sm text-text transition hover:bg-border"
        >
          ブックマーク一覧へ
        </Link>
      </div>
    </div>
  )
}
