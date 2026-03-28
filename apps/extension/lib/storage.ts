type TokenData = {
  token: string
  expiryTime: number
}

const TOKEN_KEY = 'local:authTokenData'

const tokenDataStorage = storage.defineItem<TokenData | null>(TOKEN_KEY, {
  fallback: null,
})

export async function saveToken(token: string, expiresIn: number): Promise<void> {
  const expiryTime = Date.now() + expiresIn * 1000
  await tokenDataStorage.setValue({ token, expiryTime })
}

export async function getTokenData(): Promise<TokenData | null> {
  return tokenDataStorage.getValue()
}

export async function getToken(): Promise<string | null> {
  const data = await tokenDataStorage.getValue()
  return data?.token ?? null
}

export async function removeToken(): Promise<void> {
  await tokenDataStorage.removeValue()
}

export async function isTokenExpired(): Promise<boolean> {
  const data = await tokenDataStorage.getValue()
  if (!data) return true
  return Date.now() >= data.expiryTime
}
