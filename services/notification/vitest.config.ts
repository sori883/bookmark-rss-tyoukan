import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@bookmark-rss/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
    },
  },
})
