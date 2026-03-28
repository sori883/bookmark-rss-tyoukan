import { createFileRoute } from '@tanstack/react-router'
import { settingsQueryOptions } from '~/hooks/use-settings'
import { SettingsForm } from '~/components/settings/settings-form'
import { serverRequest } from '~/lib/server-fetcher'
import type { SettingsResponse } from '~/types/api'

export const Route = createFileRoute('/_authenticated/settings/')({
  loader: async ({ context: { queryClient, jwt } }) => {
    if (typeof window === 'undefined' && jwt) {
      const data = await serverRequest<SettingsResponse>('/settings', jwt)
      queryClient.setQueryData(['settings'] as const, data)
    } else {
      await queryClient.ensureQueryData(settingsQueryOptions)
    }
  },
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">設定</h1>
      <section className="rounded-lg bg-bg-card p-6">
        <h2 className="mb-4 font-medium">Webhook通知設定</h2>
        <SettingsForm />
      </section>
    </div>
  )
}
