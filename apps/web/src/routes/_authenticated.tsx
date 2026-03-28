import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { getServerSession } from '~/lib/server-auth'
import { cacheJwt } from '~/lib/auth'
import { AppLayout } from '~/components/layout/app-layout'
import { Loading } from '~/components/ui/loading'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const session = await getServerSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    // クライアント側でのみ JWT キャッシュ（サーバーのグローバル変数汚染を防止）
    if (typeof window !== 'undefined' && session.jwt) {
      cacheJwt(session.jwt)
    }
    return { user: session.user, jwt: session.jwt }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext()

  if (!user) {
    return <Loading fullScreen />
  }

  return (
    <AppLayout user={user}>
      <Outlet />
    </AppLayout>
  )
}
