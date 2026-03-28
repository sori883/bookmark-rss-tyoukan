import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { notificationsQueryOptions } from '~/hooks/use-notifications'
import { NotificationList } from '~/components/notifications/notification-list'
import { serverRequest } from '~/lib/server-fetcher'
import { toQueryString } from '~/lib/api-client'
import type { PaginatedResponse, NotificationResponse } from '~/types/api'

const searchSchema = z.object({
  page: z.number().int().positive().optional().default(1),
})

export const Route = createFileRoute('/_authenticated/notifications/')({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ context: { queryClient, jwt }, deps }) => {
    if (typeof window === 'undefined' && jwt) {
      const data = await serverRequest<
        PaginatedResponse<NotificationResponse>
      >(`/notifications${toQueryString(deps)}`, jwt)
      queryClient.setQueryData(['notifications', deps] as const, data)
    } else {
      await queryClient.ensureQueryData(notificationsQueryOptions(deps))
    }
  },
  component: NotificationsPage,
})

function NotificationsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">通知履歴</h1>
      <NotificationList
        params={{ page: search.page }}
        onPageChange={(page) =>
          navigate({ to: '/notifications', search: { page } })
        }
      />
    </div>
  )
}
