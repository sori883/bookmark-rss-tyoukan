import {
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import type { UpdateSettingsRequest } from '~/types/api'

export const settingsQueryOptions = queryOptions({
  queryKey: ['settings'] as const,
  queryFn: () => apiClient.getSettings(),
})

export function useSettings() {
  return useQuery(settingsQueryOptions)
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: UpdateSettingsRequest) => apiClient.updateSettings(body),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data)
    },
  })
}
