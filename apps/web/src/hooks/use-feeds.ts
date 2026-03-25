import {
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import type { CreateFeedRequest, FeedResponse } from '~/types/api'

export const feedsQueryOptions = queryOptions({
  queryKey: ['feeds'] as const,
  queryFn: () => apiClient.getFeeds(),
})

export function useFeeds() {
  return useQuery(feedsQueryOptions)
}

export function useCreateFeed() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: CreateFeedRequest) => apiClient.createFeed(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeds'] })
      queryClient.invalidateQueries({ queryKey: ['articles'] })
    },
  })
}

export function useDeleteFeed() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteFeed(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['feeds'] })
      const previous = queryClient.getQueryData<readonly FeedResponse[]>(['feeds'])
      queryClient.setQueryData<readonly FeedResponse[]>(
        ['feeds'],
        (old) => old?.filter((f) => f.id !== id) ?? [],
      )
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['feeds'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feeds'] })
      queryClient.invalidateQueries({ queryKey: ['articles'] })
    },
  })
}

export function useImportOpml() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: File) => apiClient.importOpml(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeds'] })
    },
  })
}
