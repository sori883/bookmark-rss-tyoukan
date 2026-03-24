const NOTIFICATION_SERVICE_URL =
  process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:3004'

async function request(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${NOTIFICATION_SERVICE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
}

export async function listNotifications(
  token: string,
  query: string,
): Promise<Response> {
  return request(`/notifications?${query}`, token)
}

export async function updateNotification(
  token: string,
  id: string,
  body: { is_read: boolean },
): Promise<Response> {
  return request(`/notifications/${id}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
