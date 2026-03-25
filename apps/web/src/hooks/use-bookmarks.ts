import {
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import type {
  PaginationParams,
  SearchBookmarksQuery,
  CreateBookmarkRequest,
  BookmarkResponse,
  PaginatedResponse,
} from '~/types/api'

export function bookmarksQueryOptions(params: PaginationParams = {}) {
  return queryOptions({
    queryKey: ['bookmarks', params] as const,
    queryFn: () => apiClient.getBookmarks(params),
  })
}

export function useBookmarks(params: PaginationParams = {}) {
  return useQuery(bookmarksQueryOptions(params))
}

export function bookmarkQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['bookmarks', 'detail', id] as const,
    queryFn: () => apiClient.getBookmark(id),
    enabled: !!id,
  })
}

export function useBookmark(id: string) {
  return useQuery(bookmarkQueryOptions(id))
}

export function useCreateBookmark() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: CreateBookmarkRequest) => apiClient.createBookmark(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
    },
  })
}

export function useDeleteBookmark() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteBookmark(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks'] })
      const queries = queryClient.getQueriesData<PaginatedResponse<BookmarkResponse>>({
        queryKey: ['bookmarks'],
      })
      for (const [key, data] of queries) {
        if (data && 'data' in data) {
          queryClient.setQueryData(key, {
            ...data,
            data: data.data.filter((b) => b.id !== id),
            total: data.total - 1,
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
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
    },
  })
}

export function searchBookmarksQueryOptions(params: SearchBookmarksQuery) {
  return queryOptions({
    queryKey: ['bookmarks', 'search', params] as const,
    queryFn: () => apiClient.searchBookmarks(params),
    enabled: !!params.q,
  })
}

export function useSearchBookmarks(params: SearchBookmarksQuery) {
  return useQuery(searchBookmarksQueryOptions(params))
}
