import type { AuthUser, SessionResponse } from '~/types/api'
import { AUTH_BASE_URL } from './constants'

type JwtCache = {
  token: string
  expiresAt: number
}

let jwtCache: JwtCache | null = null

export async function startGoogleOAuth(callbackURL: string): Promise<void> {
  const res = await fetch(`${AUTH_BASE_URL}/auth/sign-in/social`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ provider: 'google', callbackURL }),
  })

  if (!res.ok) {
    throw new Error('Failed to start OAuth flow')
  }

  const data = await res.json()
  if (data.url) {
    window.location.href = data.url
  }
}

const DEFAULT_JWT_EXPIRY_SECONDS = 3600
const CACHE_MARGIN_RATIO = 0.8

function cacheJwt(token: string): void {
  jwtCache = {
    token,
    expiresAt: Date.now() + DEFAULT_JWT_EXPIRY_SECONDS * 1000 * CACHE_MARGIN_RATIO,
  }
}

export async function fetchJwt(forceRefresh = false): Promise<string> {
  if (!forceRefresh && jwtCache && jwtCache.expiresAt > Date.now()) {
    return jwtCache.token
  }

  // Better Auth JWT plugin returns JWT in set-auth-jwt header on get-session
  const res = await fetch(`${AUTH_BASE_URL}/auth/get-session`, {
    credentials: 'include',
  })

  if (!res.ok) {
    jwtCache = null
    throw new Error('Failed to fetch JWT')
  }

  const token = res.headers.get('set-auth-jwt')
  if (!token) {
    jwtCache = null
    throw new Error('Failed to fetch JWT')
  }

  cacheJwt(token)
  return token
}

export async function getSession(): Promise<{ user: AuthUser } | null> {
  try {
    const res = await fetch(`${AUTH_BASE_URL}/auth/get-session`, {
      credentials: 'include',
    })

    if (!res.ok) {
      return null
    }

    // Cache JWT from response header if available
    const jwtHeader = res.headers.get('set-auth-jwt')
    if (jwtHeader) {
      cacheJwt(jwtHeader)
    }

    const data: SessionResponse = await res.json()
    if (!data.session || !data.user) {
      return null
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
      },
    }
  } catch {
    return null
  }
}

export async function signOut(): Promise<void> {
  jwtCache = null
  await fetch(`${AUTH_BASE_URL}/auth/sign-out`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: '{}',
  })
}

export function clearJwtCache(): void {
  jwtCache = null
}
