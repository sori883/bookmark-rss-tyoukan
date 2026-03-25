export const AUTH_BASE_URL: string =
  import.meta.env.VITE_AUTH_BASE_URL ?? 'http://localhost:3000'

export const BFF_BASE_URL: string =
  import.meta.env.VITE_BFF_BASE_URL ?? 'http://localhost:3010'

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export const QUERY_STALE_TIME = 1000 * 60
export const QUERY_CACHE_TIME = 1000 * 60 * 5

export const DEBOUNCE_MS = 300
