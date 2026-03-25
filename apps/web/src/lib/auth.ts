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

export async function fetchJwt(forceRefresh = false): Promise<string> {
  if (!forceRefresh && jwtCache && jwtCache.expiresAt > Date.now()) {
    return jwtCache.token
  }

  const res = await fetch(`${AUTH_BASE_URL}/auth/token`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!res.ok) {
    jwtCache = null
    throw new Error('Failed to fetch JWT')
  }

  const data: unknown = await res.json()

  if (
    typeof data !== 'object' ||
    data === null ||
    !('token' in data) ||
    typeof (data as Record<string, unknown>).token !== 'string'
  ) {
    throw new Error('Invalid token response')
  }

  const token = (data as { token: string; expires_in?: number }).token
  const expiresIn = (data as { expires_in?: number }).expires_in ?? 3600
  const CACHE_MARGIN_RATIO = 0.8

  jwtCache = {
    token,
    expiresAt: Date.now() + expiresIn * 1000 * CACHE_MARGIN_RATIO,
  }

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
    credentials: 'include',
  })
}

export function clearJwtCache(): void {
  jwtCache = null
}
