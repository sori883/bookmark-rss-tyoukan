import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))

const port = 3010
console.log(`bff service listening on port ${port}`)

serve({ fetch: app.fetch, port })

export default app
