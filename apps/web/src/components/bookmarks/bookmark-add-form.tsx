import { useState } from 'react'
import { useCreateBookmark } from '~/hooks/use-bookmarks'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'

export function BookmarkAddForm() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const createBookmark = useCreateBookmark()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      new URL(url)
    } catch {
      setError('有効なURLを入力してください')
      return
    }

    createBookmark.mutate(
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
          placeholder="https://example.com/article"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          error={error}
        />
      </div>
      <Button
        type="submit"
        loading={createBookmark.isPending}
        disabled={!url.trim()}
      >
        追加
      </Button>
    </form>
  )
}
