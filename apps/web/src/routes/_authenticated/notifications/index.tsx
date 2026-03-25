import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { NotificationList } from '~/components/notifications/notification-list'

const searchSchema = z.object({
  page: z.number().int().positive().optional().default(1),
})

export const Route = createFileRoute('/_authenticated/notifications/')({
  validateSearch: (search) => searchSchema.parse(search),
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
