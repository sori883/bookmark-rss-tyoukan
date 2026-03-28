import { defineConfig } from 'wxt'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'

function toHostPattern(url: string): string {
  const parsed = new URL(url)
  return `${parsed.origin}/*`
}

export default defineConfig({
  outDir: 'dist',
  manifest: (env) => {
    const viteEnv = loadEnv(env.mode, process.cwd(), 'WXT_')
    const authBaseUrl = viteEnv.WXT_AUTH_BASE_URL || 'http://localhost:3000'
    const apiBaseUrl = viteEnv.WXT_API_BASE_URL || 'http://localhost:3001'

    const hostPermissions = [...new Set([
      toHostPattern(authBaseUrl),
      toHostPattern(apiBaseUrl),
    ])]

    return {
      name: 'Bookmark RSS Tyoukan',
      description: 'ブックマーク登録のChrome拡張機能',
      permissions: ['storage', 'activeTab'],
      host_permissions: hostPermissions,
    }
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
})
