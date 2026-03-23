import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok' }))

const port = 3001
console.log(`feed service listening on port ${port}`)

serve({ fetch: app.fetch, port })

export default app
