import { Hono } from 'hono'
import type { AuthInstance } from '../auth'
import { UnauthorizedError } from '../lib/errors'

export function createMeRoute(auth: AuthInstance) {
  const app = new Hono()

  app.get('/me', async (c) => {
    const headers = c.req.raw.headers
    const session = await auth.api.getSession({ headers })

    if (!session) {
      throw new UnauthorizedError('No active session')
    }

    return c.json({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    })
  })

  return app
}
