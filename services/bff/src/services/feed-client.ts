const FEED_SERVICE_URL =
  process.env.FEED_SERVICE_URL ?? 'http://localhost:3001'

async function request(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${FEED_SERVICE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
}

export async function listFeeds(token: string): Promise<Response> {
  return request('/feeds', token)
}

export async function createFeed(
  token: string,
  body: { url: string },
): Promise<Response> {
  return request('/feeds', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function deleteFeed(
  token: string,
  id: string,
): Promise<Response> {
  return request(`/feeds/${id}`, token, { method: 'DELETE' })
}

export async function importOpml(
  token: string,
  formData: FormData,
): Promise<Response> {
  return request('/feeds/import-opml', token, {
    method: 'POST',
    body: formData,
  })
}

export async function fetchFeeds(
  token: string,
  feedId?: string,
): Promise<Response> {
  return request('/feeds/fetch', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feedId ? { feed_id: feedId } : {}),
  })
}

export async function listArticles(
  token: string,
  query: string,
): Promise<Response> {
  return request(`/articles?${query}`, token)
}

export async function getArticle(
  token: string,
  id: string,
): Promise<Response> {
  return request(`/articles/${id}`, token)
}

export async function updateArticle(
  token: string,
  id: string,
  body: { is_read: boolean },
): Promise<Response> {
  return request(`/articles/${id}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function listBookmarks(
  token: string,
  query: string,
): Promise<Response> {
  return request(`/bookmarks?${query}`, token)
}

export async function getBookmark(
  token: string,
  id: string,
): Promise<Response> {
  return request(`/bookmarks/${id}`, token)
}

export async function createBookmark(
  token: string,
  body: { article_id?: string; url?: string },
): Promise<Response> {
  return request('/bookmarks', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function deleteBookmark(
  token: string,
  id: string,
): Promise<Response> {
  return request(`/bookmarks/${id}`, token, { method: 'DELETE' })
}

export async function searchBookmarks(
  token: string,
  query: string,
): Promise<Response> {
  return request(`/bookmarks/search?${query}`, token)
}
