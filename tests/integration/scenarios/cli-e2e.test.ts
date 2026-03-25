import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { loadTestEnv, type TestEnv } from '../helpers/env'
import { generateUserJwt } from '../helpers/jwt-helper'
import { createAuthClient } from '../helpers/http-client'
import { waitForService } from '../helpers/wait-for-service'

const execFileAsync = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))

const CLI_BUILD_TIMEOUT = 180_000 // 3 minutes for cargo build
const CLI_EXEC_TIMEOUT = 30_000

/**
 * Execute the CLI binary with the given arguments.
 * Returns { stdout, stderr }.
 */
async function runCli(
  binaryPath: string,
  args: readonly string[],
  envOverrides: Record<string, string>,
): Promise<{ readonly stdout: string; readonly stderr: string }> {
  const { stdout, stderr } = await execFileAsync(binaryPath, [...args], {
    env: {
      ...process.env,
      ...envOverrides,
    },
    timeout: CLI_EXEC_TIMEOUT,
  })
  return { stdout, stderr }
}

const skipCli = Boolean(process.env.SKIP_CLI_TEST)

describe.skipIf(skipCli)('cli-e2e: CLI バイナリ結合テスト', () => {
  let env: TestEnv
  let binaryPath: string
  let token: string
  let tempHomeDir: string
  let cliEnv: Record<string, string>
  const createdFeedIds: string[] = []

  beforeAll(async () => {
    env = loadTestEnv()
    await waitForService(env.FEED_BASE_URL, { serviceName: 'feed' })

    // Build the CLI binary
    const cliDir = resolve(__dirname, '..', '..', '..', 'apps', 'cli')
    await execFileAsync('cargo', ['build'], {
      cwd: cliDir,
      timeout: CLI_BUILD_TIMEOUT,
    })
    binaryPath = join(cliDir, 'target', 'debug', 'bookmark-rss-cli')

    // Generate a test JWT
    token = await generateUserJwt('test-user-1')

    // Create a temporary home directory for token storage
    // The CLI uses dirs::config_dir() which on macOS = $HOME/Library/Application Support
    // By overriding HOME, we control where the token file is stored
    tempHomeDir = await mkdtemp(join(tmpdir(), 'cli-test-'))
    const configDir = join(tempHomeDir, 'Library', 'Application Support', 'bookmark-rss')
    await mkdir(configDir, { recursive: true })

    // Write the token file in the format expected by the CLI
    const tokenData = JSON.stringify({
      access_token: token,
      created_at: new Date().toISOString(),
    })
    await writeFile(join(configDir, 'token.json'), tokenData, 'utf-8')

    cliEnv = {
      BOOKMARK_RSS_API_URL: env.FEED_BASE_URL,
      HOME: tempHomeDir,
    }
  }, CLI_BUILD_TIMEOUT + 30_000)

  afterAll(async () => {
    // Clean up created feeds via HTTP API (CLI uses short IDs, need full IDs)
    const feedClient = createAuthClient(env.FEED_BASE_URL, token)
    const feedsRes = await feedClient.get<Array<{ id: string; url: string }>>('/feeds')
    if (feedsRes.ok) {
      for (const feed of feedsRes.data) {
        if (feed.url.includes('t=cli-')) {
          try {
            await feedClient.delete(`/feeds/${feed.id}`)
          } catch {
            // クリーンアップ失敗は無視
          }
        }
      }
    }

    // Remove the temporary home directory
    if (tempHomeDir) {
      try {
        await rm(tempHomeDir, { recursive: true, force: true })
      } catch {
        // クリーンアップ失敗は無視
      }
    }
  })

  describe('feed list', () => {
    it('フィード一覧を取得できる', async () => {
      const { stdout, stderr } = await runCli(
        binaryPath,
        ['feed', 'list'],
        cliEnv,
      )

      // CLI outputs a table with headers: ID, Title, URL, Last Fetched
      // or "No feeds found." to stderr if empty
      const output = stdout + stderr
      expect(output).toBeDefined()

      if (stderr.includes('No feeds found.')) {
        // Empty state is valid
        expect(stderr).toContain('No feeds found.')
      } else {
        // Table output should contain header columns
        expect(stdout).toContain('ID')
        expect(stdout).toContain('Title')
        expect(stdout).toContain('URL')
      }
    })
  })

  describe('feed add / list / remove', () => {
    let addedFeedId: string | undefined

    it('feed add でフィードを追加できる', async () => {
      const { stdout } = await runCli(
        binaryPath,
        ['feed', 'add', `https://github.blog/feed/?t=cli-${Date.now()}`],
        cliEnv,
      )

      // feed add outputs to stderr: "Feed added: <title> (<url>)"
      // runCli resolves with { stdout, stderr } but we only destructured stdout
      // The assertion just checks command succeeded (no throw)
      expect(stdout).toBeDefined()

    })

    it('feed list で追加したフィードが含まれる', async () => {
      const { stdout } = await runCli(
        binaryPath,
        ['feed', 'list'],
        cliEnv,
      )

      expect(stdout).toContain('github.blog')

      // Extract the feed ID from the table output for later removal
      const lines = stdout.split('\n').filter((line) => line.trim().length > 0)
      for (const line of lines) {
        if (line.includes('github.blog')) {
          const cells = line
            .split('|')
            .map((cell) => cell.trim())
            .filter((cell) => cell.length > 0)
          if (cells.length > 0 && cells[0].length >= 8) {
            addedFeedId = cells[0]
            createdFeedIds.push(addedFeedId)
            break
          }
        }
      }
    })

    // Note: feed remove はフルUUIDが必要だが CLI テーブルは短縮ID。
    // クリーンアップは afterAll で HTTP API 経由で実行。
  })

  describe('error handling', () => {
    it('不正なサブコマンドでエラー終了する', async () => {
      try {
        await runCli(binaryPath, ['invalid-command'], cliEnv)
        // Should not reach here
        expect.unreachable('Expected CLI to exit with error')
      } catch (error: unknown) {
        const execError = error as { code?: number; stderr?: string }
        // clap returns exit code 2 for invalid commands
        expect(execError.code).toBeTruthy()
        expect(execError.stderr).toContain('error')
      }
    })
  })
})
