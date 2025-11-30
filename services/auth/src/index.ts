import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import dotenv from 'dotenv'
dotenv.config()

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

serve({
  fetch: app.fetch,
  port: process.env.PORT ? parseInt(process.env.PORT) : 3010
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
