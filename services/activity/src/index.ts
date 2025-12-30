import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import dotenv from 'dotenv'
import { authMiddleware, getUser } from './middleware/auth.js'
import { db } from './db/index.js'
import { userProfiles, runs } from './db/schema.js'
import { eq, desc } from 'drizzle-orm'

dotenv.config()

const app = new Hono()

app.use('/*', cors({
  origin: 'http://localhost:4000',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.get('/', (c) => {
  return c.text('Activity Service')
})

app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'activity' }, 200)
})

// User Profile endpoints
app.get('/profile', authMiddleware(), async (c) => {
  const user = getUser(c)
  
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, user.sub),
  })
  
  if (!profile) {
    return c.json({ message: 'Profile not found' }, 404)
  }
  
  return c.json(profile)
})

app.post('/profile', authMiddleware(), async (c) => {
  const user = getUser(c)
  const body = await c.req.json()
  
  const { name, gender, height, weight, image } = body
  
  // Check if profile already exists
  const existing = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, user.sub),
  })
  
  if (existing) {
    // Update existing profile
    const updated = await db
      .update(userProfiles)
      .set({ 
        name,
        gender,
        height, 
        weight,
        image,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, user.sub))
      .returning()
    
    return c.json(updated[0])
  } else {
    // Create new profile
    const created = await db
      .insert(userProfiles)
      .values({
        userId: user.sub,
        name,
        gender,
        height,
        weight,
        image,
      })
      .returning()
    
    return c.json(created[0], 201)
  }
})

// Run endpoints
app.get('/runs', authMiddleware(), async (c) => {
  const user = getUser(c)
  
  const userRuns = await db.query.runs.findMany({
    where: eq(runs.userId, user.sub),
    orderBy: [desc(runs.startTime)],
  })
  
  return c.json(userRuns)
})

app.get('/runs/:id', authMiddleware(), async (c) => {
  const user = getUser(c)
  const id = c.req.param('id')
  
  const run = await db.query.runs.findFirst({
    where: eq(runs.id, id),
  })
  
  if (!run) {
    return c.json({ message: 'Run not found' }, 404)
  }
  
  // Verify the run belongs to the authenticated user
  if (run.userId !== user.sub) {
    return c.json({ message: 'Forbidden' }, 403)
  }
  
  return c.json(run)
})

app.post('/runs', authMiddleware(), async (c) => {
  const user = getUser(c)
  const body = await c.req.json()
  
  const { distance, duration, startTime, endTime, calories } = body
  
  // Calculate pace (min/km)
  const pace = duration / 60 / (distance / 1000)
  
  const created = await db
    .insert(runs)
    .values({
      userId: user.sub,
      distance,
      duration,
      pace: pace.toFixed(2),
      calories,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    })
    .returning()
  
  return c.json(created[0], 201)
})

const port = process.env.PORT ? parseInt(process.env.PORT) : 4002

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`Activity service is running on http://localhost:${info.port}`)
})

