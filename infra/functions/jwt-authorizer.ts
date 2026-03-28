import { createRemoteJWKSet, jwtVerify } from 'jose'

const JWKS_URL = process.env.AUTH_JWKS_URL!
const JWKS = createRemoteJWKSet(new URL(JWKS_URL))

interface AuthorizerEvent {
  readonly headers?: Record<string, string>
  readonly methodArn: string
}

interface AuthorizerResponse {
  readonly principalId: string
  readonly policyDocument: {
    readonly Version: string
    readonly Statement: readonly {
      readonly Action: string
      readonly Effect: string
      readonly Resource: string
    }[]
  }
  readonly context?: Record<string, string>
}

function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  methodArn: string,
  context?: Record<string, string>,
): AuthorizerResponse {
  // リソースARNを全メソッド・全パスに広げてキャッシュが効くようにする
  const arnParts = methodArn.split(':')
  const apiGatewayArn = arnParts[5].split('/')
  const resource = `${arnParts[0]}:${arnParts[1]}:${arnParts[2]}:${arnParts[3]}:${arnParts[4]}:${apiGatewayArn[0]}/${apiGatewayArn[1]}/*`

  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    ...(context ? { context } : {}),
  }
}

export async function handler(
  event: AuthorizerEvent,
): Promise<AuthorizerResponse> {
  const authHeader = event.headers?.Authorization ?? event.headers?.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

  if (!token) {
    return generatePolicy('anonymous', 'Deny', event.methodArn)
  }

  try {
    const { payload } = await jwtVerify(token, JWKS)

    return generatePolicy(
      (payload.sub as string) ?? 'unknown',
      'Allow',
      event.methodArn,
      {
        userId: (payload.sub as string) ?? '',
        type: (payload.type as string) ?? 'user',
      },
    )
  } catch {
    return generatePolicy('anonymous', 'Deny', event.methodArn)
  }
}
