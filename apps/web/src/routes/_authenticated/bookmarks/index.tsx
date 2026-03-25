import { useState, useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { BookmarkList } from '~/components/bookmarks/bookmark-list'
import { BookmarkSearch } from '~/components/bookmarks/bookmark-search'
import { BookmarkAddForm } from '~/components/bookmarks/bookmark-add-form'
import { Button } from '~/components/ui/button'

const searchSchema = z.object({
  tab: z.enum(['list', 'search']).optional().default('list'),
  q: z.string().optional(),
  page: z.number().int().positive().optional().default(1),
})

export const Route = createFileRoute('/_authenticated/bookmarks/')({
  validateSearch: (search) => searchSchema.parse(search),
  component: BookmarksPage,
})

function BookmarksPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [showAddForm, setShowAddForm] = useState(false)

  const setTab = (tab: 'list' | 'search') => {
    navigate({ to: '/bookmarks', search: { tab, page: 1 } })
  }

  const handleSearchChange = useCallback(
    (q: string, page: number) => {
      navigate({ to: '/bookmarks', search: { tab: 'search', q, page } })
    },
    [navigate],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">ブックマーク</h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowAddForm((v) => !v)}
        >
          {showAddForm ? '閉じる' : 'URL追加'}
        </Button>
      </div>

      {showAddForm && (
        <section className="rounded-lg bg-bg-card p-4">
          <BookmarkAddForm />
        </section>
      )}

      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setTab('list')}
          className={`px-4 py-2 text-sm transition ${
            search.tab === 'list'
              ? 'border-b-2 border-primary text-primary'
              : 'text-text-muted hover:text-text'
          }`}
        >
          一覧
        </button>
        <button
          type="button"
          onClick={() => setTab('search')}
          className={`px-4 py-2 text-sm transition ${
            search.tab === 'search'
              ? 'border-b-2 border-primary text-primary'
              : 'text-text-muted hover:text-text'
          }`}
        >
          検索
        </button>
      </div>

      {search.tab === 'list' ? (
        <BookmarkList
          params={{ page: search.page }}
          onPageChange={(page) =>
            navigate({ to: '/bookmarks', search: { ...search, page } })
          }
        />
      ) : (
        <BookmarkSearch
          initialQuery={search.q}
          page={search.page}
          onSearchChange={handleSearchChange}
        />
      )}
    </div>
  )
}
