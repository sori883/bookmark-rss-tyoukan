import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import type { ListArticlesQuery, PaginatedResponse, ArticleResponse } from '~/types/api'

export function articlesQueryOptions(params: ListArticlesQuery = {}) {
  return queryOptions({
    queryKey: ['articles', params] as const,
    queryFn: () => apiClient.getArticles(params),
  })
}

export function useArticles(params: ListArticlesQuery = {}) {
  return useQuery(articlesQueryOptions(params))
}

export function articleQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['articles', 'detail', id] as const,
    queryFn: () => apiClient.getArticle(id),
    enabled: !!id,
  })
}

export function useArticle(id: string) {
  return useQuery(articleQueryOptions(id))
}

export function useMarkArticleRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => apiClient.updateArticle(id, { is_read: true }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['articles'] })

      const queries = queryClient.getQueriesData<PaginatedResponse<ArticleResponse>>({
        queryKey: ['articles'],
      })

      for (const [queryKey, data] of queries) {
        if (!data) continue
        queryClient.setQueryData(queryKey, {
          ...data,
          data: data.data.map((a) => (a.id === id ? { ...a, is_read: true } : a)),
        })
      }

      return { queries }
    },
    onError: (_err, _id, context) => {
      if (context?.queries) {
        for (const [queryKey, data] of context.queries) {
          queryClient.setQueryData(queryKey, data)
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] })
    },
  })
}
