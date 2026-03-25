export type PaginationParams = {
  readonly page?: number
  readonly limit?: number
}

export type PaginatedResponse<T> = {
  readonly data: readonly T[]
  readonly total: number
  readonly page: number
  readonly limit: number
}

export type ErrorResponse = {
  readonly error: {
    readonly code: string
    readonly message: string
  }
}

export type FeedResponse = {
  readonly id: string
  readonly user_id: string
  readonly url: string
  readonly title: string
  readonly site_url: string
  readonly last_fetched_at: string | null
  readonly created_at: string
}

export type CreateFeedRequest = {
  readonly url: string
}

export type ArticleResponse = {
  readonly id: string
  readonly user_id: string
  readonly feed_id: string
  readonly url: string
  readonly title: string
  readonly is_read: boolean
  readonly published_at: string
  readonly created_at: string
  readonly updated_at: string
}

export type ListArticlesQuery = PaginationParams & {
  readonly feed_id?: string
  readonly is_read?: boolean
}

export type UpdateArticleRequest = {
  readonly is_read?: boolean
}

export type BookmarkResponse = {
  readonly id: string
  readonly user_id: string
  readonly article_id: string | null
  readonly url: string
  readonly title: string
  readonly content_markdown: string
  readonly created_at: string
  readonly updated_at: string
}

export type CreateBookmarkRequest = {
  readonly article_id?: string
  readonly url?: string
}

export type SearchBookmarksQuery = PaginationParams & {
  readonly q: string
}

export type NotificationResponse = {
  readonly id: string
  readonly user_id: string
  readonly type: 'webhook'
  readonly message: string
  readonly is_read: boolean
  readonly sent_at: string
}

export type SettingsResponse = {
  readonly webhook_url_registered: boolean
  readonly webhook_type: 'slack' | 'discord' | null
  readonly notification_hour: number
}

export type UpdateSettingsRequest = {
  readonly webhook_url?: string
  readonly webhook_type?: 'slack' | 'discord'
  readonly notification_hour?: number
}

export type AuthUser = {
  readonly id: string
  readonly email: string
  readonly name: string
}

export type SessionResponse = {
  readonly session: {
    readonly id: string
    readonly userId: string
    readonly token: string
    readonly expiresAt: string
  }
  readonly user: {
    readonly id: string
    readonly email: string
    readonly name: string
    readonly image: string | null
  }
}

export type ImportOpmlResponse = {
  readonly imported_count: number
  readonly feeds: readonly FeedResponse[]
}
