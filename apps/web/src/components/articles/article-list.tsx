import type { ListArticlesQuery, FeedResponse } from '~/types/api'
import { useArticles } from '~/hooks/use-articles'
import { ArticleCard } from './article-card'
import { Pagination } from '~/components/ui/pagination'
import { Loading } from '~/components/ui/loading'
import { ErrorMessage } from '~/components/ui/error-message'
import { EmptyState } from '~/components/ui/empty-state'
import { DEFAULT_PAGE_SIZE } from '~/lib/constants'

type ArticleListProps = {
  readonly params: ListArticlesQuery
  readonly feeds?: readonly FeedResponse[]
  readonly onPageChange: (page: number) => void
}

export function ArticleList({ params, feeds, onPageChange }: ArticleListProps) {
  const { data, isLoading, error, refetch } = useArticles(params)

  if (isLoading) return <Loading />
  if (error) return <ErrorMessage message="記事の取得に失敗しました" onRetry={() => refetch()} />
  if (!data || data.data.length === 0) {
    return <EmptyState message="記事がありません" />
  }

  const feedMap = new Map(feeds?.map((f) => [f.id, f.title]) ?? [])
  const totalPages = Math.ceil(data.total / (params.limit ?? DEFAULT_PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {data.data.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            feedTitle={feedMap.get(article.feed_id)}
          />
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
