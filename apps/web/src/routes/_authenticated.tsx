import { useEffect, useState } from 'react'
import {
  createFileRoute,
  redirect,
  Outlet,
  useNavigate,
} from '@tanstack/react-router'
import { getSession } from '~/lib/auth'
import { AppLayout } from '~/components/layout/app-layout'
import { Loading } from '~/components/ui/loading'
import type { AuthUser } from '~/types/api'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    if (typeof window === 'undefined') {
      return { user: null as AuthUser | null }
    }
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { user: session.user as AuthUser | null }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user: initialUser } = Route.useRouteContext()
  const [user, setUser] = useState<AuthUser | null>(initialUser)
  const [checking, setChecking] = useState(!initialUser)
  const navigate = useNavigate()

  useEffect(() => {
    if (initialUser) {
      setUser(initialUser)
      setChecking(false)
      return
    }
    getSession()
      .then((session) => {
        if (session) {
          setUser(session.user)
        } else {
          navigate({ to: '/login' })
        }
      })
      .catch(() => {
        navigate({ to: '/login' })
      })
      .finally(() => {
        setChecking(false)
      })
  }, [initialUser, navigate])

  if (checking || !user) {
    return <Loading fullScreen />
  }

  return (
    <AppLayout user={user}>
      <Outlet />
    </AppLayout>
  )
}
