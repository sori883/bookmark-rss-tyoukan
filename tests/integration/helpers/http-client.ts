interface RequestOptions {
  readonly headers?: Record<string, string>
  readonly body?: unknown
  readonly signal?: AbortSignal
}

interface HttpResponse<T = unknown> {
  readonly status: number
  readonly headers: Headers
  readonly data: T
  readonly ok: boolean
}

/**
 * Minimal HTTP client with Authorization header support.
 */
class AuthHttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  async get<T = unknown>(
    path: string,
    options: Omit<RequestOptions, 'body'> = {},
  ): Promise<HttpResponse<T>> {
    return this.request<T>('GET', path, options)
  }

  async post<T = unknown>(
    path: string,
    body?: unknown,
    options: Omit<RequestOptions, 'body'> = {},
  ): Promise<HttpResponse<T>> {
    return this.request<T>('POST', path, { ...options, body })
  }

  async put<T = unknown>(
    path: string,
    body?: unknown,
    options: Omit<RequestOptions, 'body'> = {},
  ): Promise<HttpResponse<T>> {
    return this.request<T>('PUT', path, { ...options, body })
  }

  async patch<T = unknown>(
    path: string,
    body?: unknown,
    options: Omit<RequestOptions, 'body'> = {},
  ): Promise<HttpResponse<T>> {
    return this.request<T>('PATCH', path, { ...options, body })
  }

  async delete<T = unknown>(
    path: string,
    options: Omit<RequestOptions, 'body'> = {},
  ): Promise<HttpResponse<T>> {
    return this.request<T>('DELETE', path, options)
  }

  private async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<HttpResponse<T>> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      ...options.headers,
    }

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(url, {
      method,
      headers,
      body: options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
      signal: options.signal,
    })

    const contentType = response.headers.get('content-type') ?? ''
    const data = contentType.includes('application/json')
      ? ((await response.json()) as T)
      : ((await response.text()) as T)

    return {
      status: response.status,
      headers: response.headers,
      data,
      ok: response.ok,
    }
  }
}

/**
 * Create an authenticated HTTP client with Bearer token.
 */
export function createAuthClient(
  baseUrl: string,
  token: string,
): AuthHttpClient {
  return new AuthHttpClient(baseUrl, token)
}

/**
 * Create an unauthenticated HTTP client (no Authorization header).
 * Useful for testing endpoints that should reject unauthenticated requests.
 */
export async function fetchWithoutAuth<T = unknown>(
  url: string,
  options: {
    readonly method?: string
    readonly body?: unknown
    readonly headers?: Record<string, string>
  } = {},
): Promise<HttpResponse<T>> {
  const headers: Record<string, string> = { ...options.headers }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined
      ? JSON.stringify(options.body)
      : undefined,
  })

  const contentType = response.headers.get('content-type') ?? ''
  const data = contentType.includes('application/json')
    ? ((await response.json()) as T)
    : ((await response.text()) as T)

  return {
    status: response.status,
    headers: response.headers,
    data,
    ok: response.ok,
  }
}
