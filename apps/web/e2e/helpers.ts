import type { BrowserContext, Page } from '@playwright/test'

const AUTH_URL = 'http://localhost:3000'
const BFF_URL = 'http://localhost:3010'

export async function mockAuth(context: BrowserContext) {
  await context.route(`${AUTH_URL}/**`, (route) => {
    const url = route.request().url()
    if (url.includes('/auth/get-session')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: { id: 's1', userId: 'u1', token: 'tok', expiresAt: '2099-01-01' },
          user: { id: 'u1', email: 'test@example.com', name: 'Test User', image: null },
        }),
      })
    }
    if (url.includes('/auth/token')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'test-jwt' }),
      })
    }
    if (url.includes('/auth/sign-out')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    }
    return route.continue()
  })
}

export async function mockBffRoute(
  page: Page,
  path: string,
  handler: (route: import('@playwright/test').Route) => void,
) {
  await page.route(`${BFF_URL}${path}`, handler)
}

export function bffUrl(path: string): string {
  return `${BFF_URL}${path}`
}
