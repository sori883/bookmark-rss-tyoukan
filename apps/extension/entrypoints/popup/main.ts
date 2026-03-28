import './style.css'
import { trySessionAuth, logout } from '@/lib/auth'
import { getTokenData } from '@/lib/storage'
import { createBookmark, AuthError } from '@/lib/api-client'
import { getWebUrl } from '@/lib/config'
import { escapeHtml } from '@/lib/sanitize'

type AppScreen = 'loading' | 'unauthenticated' | 'bookmarking' | 'success' | 'error'

type State = {
  readonly screen: AppScreen
  readonly errorMessage: string
}

let state: State = { screen: 'loading', errorMessage: '' }

const app = document.getElementById('app')!

async function getCurrentTabUrl(): Promise<string | null> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true })
  return tabs[0]?.url ?? null
}

function render(): void {
  switch (state.screen) {
    case 'loading':
      app.innerHTML = renderLoading()
      break
    case 'unauthenticated':
      app.innerHTML = renderLogin()
      document.getElementById('login-btn')?.addEventListener('click', handleLogin)
      break
    case 'bookmarking':
      app.innerHTML = renderBookmarking()
      break
    case 'success':
      app.innerHTML = renderSuccess()
      document.getElementById('close-btn')?.addEventListener('click', () => window.close())
      document.getElementById('logout-btn')?.addEventListener('click', handleLogout)
      break
    case 'error':
      app.innerHTML = renderError()
      document.getElementById('retry-btn')?.addEventListener('click', initialize)
      document.getElementById('logout-btn')?.addEventListener('click', handleLogout)
      break
  }
}

function renderLoading(): string {
  return `
    <div class="flex items-center justify-center py-8">
      <div class="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
    </div>
  `
}

function renderLogin(): string {
  return `
    <div class="space-y-4">
      <h1 class="text-lg font-bold text-gray-900">Bookmark RSS</h1>
      <p class="text-sm text-gray-600">Webアプリにログイン後、もう一度クリックしてください</p>
      <button id="login-btn" class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
        ログインページを開く
      </button>
    </div>
  `
}

function renderBookmarking(): string {
  return `
    <div class="space-y-3">
      <h1 class="text-lg font-bold text-gray-900">Bookmark RSS</h1>
      <div class="flex items-center gap-2 py-3 justify-center">
        <div class="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        <span class="text-sm text-gray-600">登録中...</span>
      </div>
    </div>
  `
}

function renderSuccess(): string {
  return `
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-bold text-gray-900">Bookmark RSS</h1>
        <button id="logout-btn" class="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          ログアウト
        </button>
      </div>
      <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
        <p class="text-sm text-green-700 font-medium">ブックマークを登録しました</p>
      </div>
      <button id="close-btn" class="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm">
        閉じる
      </button>
    </div>
  `
}

function renderError(): string {
  return `
    <div class="space-y-3">
      <h1 class="text-lg font-bold text-gray-900">Bookmark RSS</h1>
      <div class="bg-red-50 border border-red-200 rounded-lg p-3">
        <p class="text-sm text-red-700">${escapeHtml(state.errorMessage)}</p>
      </div>
      <div class="flex gap-2">
        <button id="retry-btn" class="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm">
          再試行
        </button>
        <button id="logout-btn" class="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm">
          ログアウト
        </button>
      </div>
    </div>
  `
}

function handleLogin(): void {
  browser.tabs.create({ url: `${getWebUrl()}/login` })
  window.close()
}

async function handleLogout(): Promise<void> {
  await logout()
  setState({ screen: 'unauthenticated', errorMessage: '' })
}

async function doBookmark(): Promise<void> {
  const url = await getCurrentTabUrl()
  if (!url) {
    setState({ screen: 'error', errorMessage: 'タブのURLを取得できませんでした' })
    return
  }

  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    setState({ screen: 'error', errorMessage: 'このページはブックマークできません' })
    return
  }

  setState({ screen: 'bookmarking' })

  try {
    await createBookmark(url)
    setState({ screen: 'success' })
  } catch (error) {
    if (error instanceof AuthError) {
      setState({ screen: 'unauthenticated', errorMessage: '' })
    } else {
      const msg = error instanceof Error ? error.message : 'ブックマーク登録に失敗しました'
      setState({ screen: 'error', errorMessage: msg })
    }
  }
}

function setState(patch: Partial<State>): void {
  state = { ...state, ...patch }
  render()
}

async function isAuthenticated(): Promise<boolean> {
  // まずストレージの JWT を確認
  const data = await getTokenData()
  if (data && Date.now() < data.expiryTime) {
    return true
  }

  // JWT なし or 期限切れ → Cookie から取得を試みる
  return trySessionAuth()
}

async function initialize(): Promise<void> {
  setState({ screen: 'loading', errorMessage: '' })

  const authed = await isAuthenticated()
  if (authed) {
    // 認証済み → 即座にブックマーク実行
    await doBookmark()
  } else {
    setState({ screen: 'unauthenticated' })
  }
}

initialize()
