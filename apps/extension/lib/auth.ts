import { getAuthBaseUrl } from './config'
import { saveToken, removeToken } from './storage'

/**
 * ポップアップから直接呼び出す。
 * ブラウザのセッション Cookie を使って JWT を取得する。
 */
export async function trySessionAuth(): Promise<boolean> {
  const authUrl = getAuthBaseUrl()

  try {
    const res = await fetch(`${authUrl}/auth/get-session`, {
      credentials: 'include',
    })

    if (!res.ok) {
      return false
    }

    const jwt = res.headers.get('set-auth-jwt')
    if (!jwt) {
      return false
    }

    await saveToken(jwt, 3600)
    return true
  } catch {
    return false
  }
}

export async function logout(): Promise<void> {
  await removeToken()
}
