import { useState, useEffect } from 'react'
import { useSettings, useUpdateSettings } from '~/hooks/use-settings'
import { Input } from '~/components/ui/input'
import { Select } from '~/components/ui/select'
import { Button } from '~/components/ui/button'
import { Loading } from '~/components/ui/loading'
import { ErrorMessage } from '~/components/ui/error-message'

const webhookTypeOptions = [
  { value: 'slack', label: 'Slack' },
  { value: 'discord', label: 'Discord' },
] as const

export function SettingsForm() {
  const { data: settings, isLoading, error, refetch } = useSettings()
  const updateSettings = useUpdateSettings()
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookType, setWebhookType] = useState('')
  const [urlError, setUrlError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) {
      setWebhookUrl(settings.webhook_url ?? '')
      setWebhookType(settings.webhook_type ?? '')
    }
  }, [settings])

  if (isLoading) return <Loading />
  if (error) return <ErrorMessage message="設定の取得に失敗しました" onRetry={() => refetch()} />

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setUrlError('')
    setSaved(false)

    if (webhookUrl) {
      try {
        new URL(webhookUrl)
      } catch {
        setUrlError('有効なURLを入力してください')
        return
      }
    }

    updateSettings.mutate(
      {
        webhook_url: webhookUrl || undefined,
        webhook_type: (webhookType as 'slack' | 'discord') || undefined,
      },
      {
        onSuccess: () => setSaved(true),
        onError: (err) => setUrlError(err.message),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <Select
        id="webhook-type"
        label="Webhookタイプ"
        options={[...webhookTypeOptions]}
        placeholder="選択してください"
        value={webhookType}
        onChange={(e) => setWebhookType(e.target.value)}
      />
      <Input
        id="webhook-url"
        label="Webhook URL"
        type="url"
        placeholder="https://hooks.slack.com/services/..."
        value={webhookUrl}
        onChange={(e) => setWebhookUrl(e.target.value)}
        error={urlError}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" loading={updateSettings.isPending}>
          保存
        </Button>
        {saved && (
          <span className="text-sm text-success">保存しました</span>
        )}
      </div>
    </form>
  )
}
