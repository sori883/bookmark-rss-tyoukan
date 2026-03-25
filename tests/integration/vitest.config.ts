import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['scenarios/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@bookmark-rss/db': resolve(__dirname, '../../packages/db/src/index.ts'),
    },
  },
})
