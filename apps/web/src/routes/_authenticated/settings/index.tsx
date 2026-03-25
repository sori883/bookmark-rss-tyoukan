import { createFileRoute } from '@tanstack/react-router'
import { SettingsForm } from '~/components/settings/settings-form'

export const Route = createFileRoute('/_authenticated/settings/')({
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
