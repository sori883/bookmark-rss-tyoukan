import { createFileRoute, redirect } from '@tanstack/react-router'
import { getServerSession } from '~/lib/server-auth'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await getServerSession()
    if (session) {
      throw redirect({ to: '/articles', search: { page: 1 } })
    }
    throw redirect({ to: '/login' })
  },
})
