import {
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import type { PaginationParams, NotificationResponse, PaginatedResponse } from '~/types/api'

export function notificationsQueryOptions(params: PaginationParams = {}) {
  return queryOptions({
    queryKey: ['notifications', params] as const,
    queryFn: () => apiClient.getNotifications(params),
    staleTime: 0,
  })
}

export function useNotifications(params: PaginationParams = {}) {
  return useQuery(notificationsQueryOptions(params))
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => apiClient.markNotificationRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] })
      const queries = queryClient.getQueriesData<PaginatedResponse<NotificationResponse>>({
        queryKey: ['notifications'],
      })
      for (const [key, data] of queries) {
        if (data && 'data' in data) {
          queryClient.setQueryData(key, {
            ...data,
            data: data.data.map((n) =>
              n.id === id ? { ...n, is_read: true } : n,
            ),
          })
        }
      }
      return { queries }
    },
    onError: (_err, _id, context) => {
      if (context?.queries) {
        for (const [key, data] of context.queries) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
