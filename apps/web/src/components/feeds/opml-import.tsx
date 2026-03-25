import { useRef, useState } from 'react'
import { useImportOpml } from '~/hooks/use-feeds'
import { Button } from '~/components/ui/button'

export function OpmlImport() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const importOpml = useImportOpml()

  const handleImport = () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setMessage('')
    importOpml.mutate(file, {
      onSuccess: (data) => {
        setMessage(`${data.imported_count}件のフィードをインポートしました`)
        if (fileRef.current) fileRef.current.value = ''
      },
      onError: (err) => setMessage(`インポートに失敗しました: ${err.message}`),
    })
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <label className="text-sm font-medium text-text-muted">OPMLインポート</label>
        <input
          ref={fileRef}
          type="file"
          accept=".opml,.xml"
          className="mt-1 block w-full text-sm text-text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-bg-hover file:px-4 file:py-2 file:text-sm file:text-text"
        />
      </div>
      <Button
        variant="secondary"
        loading={importOpml.isPending}
        onClick={handleImport}
      >
        インポート
      </Button>
      {message && (
        <p className={`text-sm ${importOpml.isError ? 'text-danger' : 'text-success'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
