import { getApiBaseUrl } from './config'
import { getTokenData } from './storage'

export class AuthError extends Error {
  constructor(message = '認証が必要です。ログインしてください。') {
    super(message)
    this.name = 'AuthError'
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const data = await getTokenData()
  if (!data || Date.now() >= data.expiryTime) {
    throw new AuthError()
  }

  return {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  }
}

function validateUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('無効なURLです')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('http または https のURLのみ登録できます')
  }
}

export type BookmarkResponse = {
  id: string
  user_id: string
  article_id: string | null
  url: string
  title: string
  content_markdown: string
  created_at: string
  updated_at: string
}

export async function createBookmark(url: string): Promise<BookmarkResponse> {
  validateUrl(url)

  const headers = await getAuthHeaders()

  const res = await fetch(`${getApiBaseUrl()}/bookmarks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url }),
  })

  if (res.status === 401) {
    throw new AuthError()
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const message = body?.error?.message ?? `ブックマーク登録に失敗しました: ${res.status}`
    throw new Error(message)
  }

  return res.json()
}
