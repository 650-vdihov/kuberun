import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('/*', cors({
  origin: '*', // Allow all origins (or specify ['http://localhost:8081'] for more security)
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}))

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/users', (c) => {
  const users = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ]
  return c.json(users)
});

app.get('/health', (c) => {
  return c.json({ status: 'ok' }, 200);
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
