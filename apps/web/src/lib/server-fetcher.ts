import { resolveBaseUrl } from './api-client'

export async function serverRequest<T>(
  path: string,
  jwt: string,
): Promise<T> {
  const baseUrl = resolveBaseUrl(path)
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  })

  if (!res.ok) {
    throw new Error(`Server fetch failed: ${res.status} ${res.statusText}`)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
