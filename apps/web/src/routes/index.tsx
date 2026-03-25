import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSession } from '~/lib/auth'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await getSession()
    if (session) {
      throw redirect({ to: '/articles', search: { page: 1 } })
    }
    throw redirect({ to: '/login' })
  },
})
