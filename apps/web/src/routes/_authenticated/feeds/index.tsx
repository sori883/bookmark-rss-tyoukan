import { createFileRoute } from '@tanstack/react-router'
import { FeedAddForm } from '~/components/feeds/feed-add-form'
import { OpmlImport } from '~/components/feeds/opml-import'
import { FeedList } from '~/components/feeds/feed-list'

export const Route = createFileRoute('/_authenticated/feeds/')({
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
