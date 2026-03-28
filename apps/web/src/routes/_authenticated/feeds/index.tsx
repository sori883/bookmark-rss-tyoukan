import { createFileRoute } from '@tanstack/react-router'
import { feedsQueryOptions } from '~/hooks/use-feeds'
import { FeedAddForm } from '~/components/feeds/feed-add-form'
import { OpmlImport } from '~/components/feeds/opml-import'
import { FeedList } from '~/components/feeds/feed-list'
import { serverRequest } from '~/lib/server-fetcher'
import type { FeedResponse } from '~/types/api'

export const Route = createFileRoute('/_authenticated/feeds/')({
  loader: async ({ context: { queryClient, jwt } }) => {
    if (typeof window === 'undefined' && jwt) {
      const data = await serverRequest<readonly FeedResponse[]>('/feeds', jwt)
      queryClient.setQueryData(['feeds'] as const, data)
    } else {
      await queryClient.ensureQueryData(feedsQueryOptions)
    }
  },
  component: FeedsPage,
})

function FeedsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">フィード管理</h1>

      <section className="space-y-4 rounded-lg bg-bg-card p-4">
        <h2 className="font-medium">フィード登録</h2>
        <FeedAddForm />
      </section>

      <section className="space-y-4 rounded-lg bg-bg-card p-4">
        <OpmlImport />
      </section>

      <section className="space-y-4">
        <h2 className="font-medium">登録済みフィード</h2>
        <FeedList />
      </section>
    </div>
  )
}
