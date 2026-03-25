import type {
  PaginatedResponse,
  FeedResponse,
  ArticleResponse,
  BookmarkResponse,
  NotificationResponse,
  SettingsResponse,
  CreateFeedRequest,
  CreateBookmarkRequest,
  ListArticlesQuery,
  SearchBookmarksQuery,
  UpdateSettingsRequest,
  PaginationParams,
  ImportOpmlResponse,
  ErrorResponse,
} from '~/types/api'
import { API_BASE_URL, NOTIFICATION_BASE_URL } from './constants'
import { fetchJwt } from './auth'

class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function resolveBaseUrl(path: string): string {
  if (path.startsWith('/notifications')) {
    return NOTIFICATION_BASE_URL
  }
  return API_BASE_URL
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const baseUrl = resolveBaseUrl(path)
  const token = await fetchJwt()

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  })

  if (res.status === 401 && retry) {
    const newToken = await fetchJwt(true)
    const retryRes = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${newToken}`,
      },
    })

    if (!retryRes.ok) {
      const err: ErrorResponse = await retryRes.json().catch(() => ({
        error: { code: 'UNKNOWN', message: retryRes.statusText },
      }))
      throw new ApiError(err.error.code, err.error.message, retryRes.status)
    }

    if (retryRes.status === 204) return undefined as T
    return retryRes.json() as Promise<T>
  }

  if (!res.ok) {
    const err: ErrorResponse = await res.json().catch(() => ({
      error: { code: 'UNKNOWN', message: res.statusText },
    }))
    throw new ApiError(err.error.code, err.error.message, res.status)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function toQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  )
  if (entries.length === 0) return ''
  const searchParams = new URLSearchParams()
  for (const [key, value] of entries) {
    searchParams.set(key, String(value))
  }
  return `?${searchParams.toString()}`
}

export const apiClient = {
  getFeeds(): Promise<readonly FeedResponse[]> {
    return request<FeedResponse[]>('/feeds')
  },

  createFeed(body: CreateFeedRequest): Promise<FeedResponse> {
    return request<FeedResponse>('/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  },

  deleteFeed(id: string): Promise<void> {
    return request<void>(`/feeds/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  importOpml(file: File): Promise<ImportOpmlResponse> {
    const formData = new FormData()
    formData.append('file', file)
    return request<ImportOpmlResponse>('/feeds/import-opml', {
      method: 'POST',
      body: formData,
    })
  },

  getArticles(
    params: ListArticlesQuery = {},
  ): Promise<PaginatedResponse<ArticleResponse>> {
    return request<PaginatedResponse<ArticleResponse>>(
      `/articles${toQueryString(params)}`,
    )
  },

  getArticle(id: string): Promise<ArticleResponse> {
    return request<ArticleResponse>(`/articles/${encodeURIComponent(id)}`)
  },

  getBookmarks(
    params: PaginationParams = {},
  ): Promise<PaginatedResponse<BookmarkResponse>> {
    return request<PaginatedResponse<BookmarkResponse>>(
      `/bookmarks${toQueryString(params)}`,
    )
  },

  getBookmark(id: string): Promise<BookmarkResponse> {
    return request<BookmarkResponse>(`/bookmarks/${encodeURIComponent(id)}`)
  },

  createBookmark(body: CreateBookmarkRequest): Promise<BookmarkResponse> {
    return request<BookmarkResponse>('/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  },

  deleteBookmark(id: string): Promise<void> {
    return request<void>(`/bookmarks/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  searchBookmarks(
    params: SearchBookmarksQuery,
  ): Promise<PaginatedResponse<BookmarkResponse>> {
    return request<PaginatedResponse<BookmarkResponse>>(
      `/bookmarks/search${toQueryString(params)}`,
    )
  },

  getNotifications(
    params: PaginationParams = {},
  ): Promise<PaginatedResponse<NotificationResponse>> {
    return request<PaginatedResponse<NotificationResponse>>(
      `/notifications${toQueryString(params)}`,
    )
  },

  markNotificationRead(id: string): Promise<NotificationResponse> {
    return request<NotificationResponse>(`/notifications/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    })
  },

  getSettings(): Promise<SettingsResponse> {
    return request<SettingsResponse>('/settings')
  },

  updateSettings(body: UpdateSettingsRequest): Promise<SettingsResponse> {
    return request<SettingsResponse>('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  },
} as const
