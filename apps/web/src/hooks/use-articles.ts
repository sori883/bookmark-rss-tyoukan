import { useQuery, queryOptions } from '@tanstack/react-query'
import { apiClient } from '~/lib/api-client'
import type { ListArticlesQuery } from '~/types/api'

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
