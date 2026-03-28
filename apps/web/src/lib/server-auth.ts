import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { AUTH_BASE_URL } from './constants'
import type { AuthUser } from '~/types/api'

type ServerSession = {
  readonly user: AuthUser
  readonly jwt: string | null
}

export const getServerSession = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ServerSession | null> => {
    const cookie = getRequestHeader('cookie')
    if (!cookie) return null

    const res = await fetch(`${AUTH_BASE_URL}/auth/get-session`, {
      headers: { cookie },
    })

    if (!res.ok) return null

    const jwt = res.headers.get('set-auth-jwt')
    const data = await res.json().catch(() => null)

    if (!data?.session || !data?.user) return null

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
      },
      jwt,
    }
  },
)
