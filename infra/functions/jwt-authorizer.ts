import { createRemoteJWKSet, jwtVerify } from 'jose'

const JWKS_URL = process.env.AUTH_JWKS_URL!
const JWKS = createRemoteJWKSet(new URL(JWKS_URL))

interface AuthorizerEvent {
  readonly headers?: Record<string, string>
  readonly routeArn: string
}

interface AuthorizerResponse {
  readonly isAuthorized: boolean
  readonly context: Record<string, string>
}

export async function handler(
  event: AuthorizerEvent,
): Promise<AuthorizerResponse> {
  const authHeader = event.headers?.authorization ?? event.headers?.Authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

  if (!token) {
    return { isAuthorized: false, context: {} }
  }

  try {
    const { payload } = await jwtVerify(token, JWKS)

    return {
      isAuthorized: true,
      context: {
        userId: (payload.sub as string) ?? '',
        type: (payload.type as string) ?? 'user',
      },
    }
  } catch {
    return { isAuthorized: false, context: {} }
  }
}
