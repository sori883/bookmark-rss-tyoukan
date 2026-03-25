const DEFAULT_TIMEOUT_MS = 60_000
const POLL_INTERVAL_MS = 1_000

interface WaitOptions {
  /** Maximum time to wait in milliseconds. Default: 60000 */
  readonly timeoutMs?: number
  /** Polling interval in milliseconds. Default: 1000 */
  readonly intervalMs?: number
  /** Service name for log messages */
  readonly serviceName?: string
}

/**
 * Wait for a service to become healthy by polling its /health endpoint.
 * Returns when a 200 response is received.
 * Throws if the timeout is reached.
 */
export async function waitForService(
  baseUrl: string,
  options: WaitOptions = {},
): Promise<void> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    intervalMs = POLL_INTERVAL_MS,
    serviceName = baseUrl,
  } = options

  const healthUrl = `${baseUrl}/health`
  const deadline = Date.now() + timeoutMs

  console.info(`[wait] Waiting for ${serviceName} at ${healthUrl}...`)

  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, {
        signal: AbortSignal.timeout(intervalMs),
      })

      if (response.ok) {
        console.info(`[wait] ${serviceName} is ready`)
        return
      }
    } catch {
      // Service not ready yet, continue polling
    }

    await sleep(intervalMs)
  }

  throw new Error(
    `[wait] ${serviceName} did not become healthy within ${timeoutMs}ms`,
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wait for multiple services to become healthy in parallel.
 */
export async function waitForServices(
  services: ReadonlyArray<{ readonly baseUrl: string; readonly name: string }>,
  options: Omit<WaitOptions, 'serviceName'> = {},
): Promise<void> {
  await Promise.all(
    services.map((service) =>
      waitForService(service.baseUrl, {
        ...options,
        serviceName: service.name,
      }),
    ),
  )
}
