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

const notificationHourOptions = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: `${i}:00`,
}))

export function SettingsForm() {
  const { data: settings, isLoading, error, refetch } = useSettings()
  const updateSettings = useUpdateSettings()
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookType, setWebhookType] = useState('')
  const [notificationHour, setNotificationHour] = useState('9')
  const [urlError, setUrlError] = useState('')
  const [saved, setSaved] = useState(false)
  const [isEditingUrl, setIsEditingUrl] = useState(false)

  useEffect(() => {
    if (settings) {
      setWebhookType(settings.webhook_type ?? '')
      setNotificationHour(String(settings.notification_hour))
      setIsEditingUrl(!settings.webhook_url_registered)
    }
  }, [settings])

  if (isLoading) return <Loading />
  if (error) return <ErrorMessage message="設定の取得に失敗しました" onRetry={() => refetch()} />

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setUrlError('')
    setSaved(false)

    if (isEditingUrl && webhookUrl) {
      try {
        new URL(webhookUrl)
      } catch {
        setUrlError('有効なURLを入力してください')
        return
      }
    }

    updateSettings.mutate(
      {
        webhook_url: isEditingUrl && webhookUrl ? webhookUrl : undefined,
        webhook_type: (webhookType as 'slack' | 'discord') || undefined,
        notification_hour: Number(notificationHour),
      },
      {
        onSuccess: () => {
          setSaved(true)
          setWebhookUrl('')
          setIsEditingUrl(false)
        },
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
      {isEditingUrl ? (
        <div className="space-y-2">
          <Input
            id="webhook-url"
            label="Webhook URL"
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            error={urlError}
          />
          {settings?.webhook_url_registered && (
            <button
              type="button"
              className="text-sm text-text-muted hover:text-text"
              onClick={() => {
                setIsEditingUrl(false)
                setWebhookUrl('')
                setUrlError('')
              }}
            >
              キャンセル
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <label className="block text-sm font-medium">Webhook URL</label>
          <div className="flex items-center gap-3">
            <span className="rounded bg-success/20 px-2 py-1 text-sm text-success">
              登録済み
            </span>
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => setIsEditingUrl(true)}
            >
              変更する
            </button>
          </div>
        </div>
      )}
      <Select
        id="notification-hour"
        label="通知時間"
        options={notificationHourOptions}
        value={notificationHour}
        onChange={(e) => setNotificationHour(e.target.value)}
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
