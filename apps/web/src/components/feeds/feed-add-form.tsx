import { useState } from 'react'
import { useCreateFeed } from '~/hooks/use-feeds'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'

export function FeedAddForm() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const createFeed = useCreateFeed()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      new URL(url)
    } catch {
      setError('有効なURLを入力してください')
      return
    }

    createFeed.mutate(
      { url },
      {
        onSuccess: () => setUrl(''),
        onError: (err) => setError(err.message),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="flex-1">
        <Input
          type="url"
          placeholder="https://example.com/feed.xml"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          error={error}
        />
      </div>
      <Button
        type="submit"
        loading={createFeed.isPending}
        disabled={!url.trim()}
      >
        追加
      </Button>
    </form>
  )
}
