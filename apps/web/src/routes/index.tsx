import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { getSession } from '~/lib/auth'
import { Loading } from '~/components/ui/loading'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    if (typeof window === 'undefined') {
      return
    }
    const session = await getSession()
    if (session) {
      throw redirect({ to: '/articles', search: { page: 1 } })
    }
    throw redirect({ to: '/login' })
  },
  component: IndexRedirect,
})

function IndexRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    getSession()
      .then((session) => {
        if (session) {
          navigate({ to: '/articles', search: { page: 1 } })
        } else {
          navigate({ to: '/login' })
        }
      })
      .catch(() => {
        navigate({ to: '/login' })
      })
  }, [navigate])

  return <Loading fullScreen />
}
