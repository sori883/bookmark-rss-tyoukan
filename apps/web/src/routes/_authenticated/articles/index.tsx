import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Eye, EyeOff } from 'lucide-react'
import { z } from 'zod'
import { useFeeds } from '~/hooks/use-feeds'
import { ArticleList } from '~/components/articles/article-list'
import { Select } from '~/components/ui/select'

const searchSchema = z.object({
  feed_id: z.string().optional(),
  is_read: z.boolean().optional(),
  page: z.number().int().positive().optional().default(1),
})

export const Route = createFileRoute('/_authenticated/articles/')({
  validateSearch: (search) => searchSchema.parse(search),
  component: ArticlesPage,
})

function ArticlesPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const { data: feeds } = useFeeds()

  const feedOptions = (feeds ?? []).map((f) => ({
    value: f.id,
    label: f.title || f.url,
  }))

  const updateSearch = (updates: Partial<z.infer<typeof searchSchema>>) => {
    navigate({
      to: '/articles',
      search: { ...search, page: 1, ...updates },
    })
  }

  const isUnreadOnly = search.is_read === false

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">記事一覧</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-48">
          <Select
            options={feedOptions}
            placeholder="全てのフィード"
            value={search.feed_id ?? ''}
            onChange={(e) =>
              updateSearch({ feed_id: e.target.value || undefined })
            }
          />
        </div>
        <button
          type="button"
          onClick={() =>
            updateSearch({ is_read: isUnreadOnly ? undefined : false })
          }
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
            isUnreadOnly
              ? 'bg-primary/20 text-primary'
              : 'bg-bg-card text-text-muted hover:bg-bg-hover'
          }`}
        >
          {isUnreadOnly ? <EyeOff size={16} /> : <Eye size={16} />}
          未読のみ
        </button>
      </div>

      <ArticleList
        params={{
          feed_id: search.feed_id,
          is_read: search.is_read,
          page: search.page,
        }}
        feeds={feeds}
        onPageChange={(page) => updateSearch({ page })}
      />
    </div>
  )
}
