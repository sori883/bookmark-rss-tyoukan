const DEFAULT_AUTH_BASE_URL = 'http://localhost:3000'
const DEFAULT_API_BASE_URL = 'http://localhost:3001'
const DEFAULT_WEB_URL = 'http://localhost:5173'

export function getAuthBaseUrl(): string {
  return import.meta.env.WXT_AUTH_BASE_URL ?? DEFAULT_AUTH_BASE_URL
}

export function getApiBaseUrl(): string {
  return import.meta.env.WXT_API_BASE_URL ?? DEFAULT_API_BASE_URL
}

export function getWebUrl(): string {
  return import.meta.env.WXT_WEB_URL ?? DEFAULT_WEB_URL
}
