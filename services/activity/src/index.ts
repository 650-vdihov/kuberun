import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import dotenv from 'dotenv'
import { authMiddleware, getUser } from './middleware/auth.js'
import { db } from './db/index.js'
import { userProfiles, runs, runTrackingPoints } from './db/schema.js'
import { eq, desc, and, sql, gte, lte, count } from 'drizzle-orm'

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

// Run endpoints with pagination and filtering
app.get('/runs', authMiddleware(), async (c) => {
  const user = getUser(c)
  
  // Pagination params
  const page = parseInt(c.req.query('page') || '1')
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)
  const offset = (page - 1) * limit
  
  // Timeframe filter params
  const timeframe = c.req.query('timeframe') // today, week, month, year
  const fromDate = c.req.query('from') // custom from date (YYYY-MM-DD)
  const toDate = c.req.query('to') // custom to date (YYYY-MM-DD)
  
  // Build where conditions
  const conditions = [
    eq(runs.userId, user.sub),
    eq(runs.status, 'completed')
  ]
  
  // Add timeframe conditions
  const now = new Date()
  
  if (timeframe === 'today') {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    conditions.push(gte(runs.startTime, startOfDay))
  } else if (timeframe === 'week') {
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay()) // Start of current week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0)
    conditions.push(gte(runs.startTime, startOfWeek))
  } else if (timeframe === 'month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    conditions.push(gte(runs.startTime, startOfMonth))
  } else if (timeframe === 'year') {
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    conditions.push(gte(runs.startTime, startOfYear))
  }
  
  // Custom date range
  if (fromDate) {
    const from = new Date(fromDate)
    from.setHours(0, 0, 0, 0)
    conditions.push(gte(runs.startTime, from))
  }
  
  if (toDate) {
    const to = new Date(toDate)
    to.setHours(23, 59, 59, 999)
    conditions.push(lte(runs.startTime, to))
  }
  
  const whereClause = and(...conditions)
  
  // Get total count for pagination
  const countResult = await db
    .select({ count: count() })
    .from(runs)
    .where(whereClause)
  
  const total = countResult[0]?.count ?? 0
  const totalPages = Math.ceil(total / limit)
  
  // Get paginated runs
  const userRuns = await db.query.runs.findMany({
    where: whereClause,
    orderBy: [desc(runs.startTime)],
    limit,
    offset,
  })
  
  return c.json({
    runs: userRuns,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    }
  })
})

// Start a new run
app.post('/runs/start', authMiddleware(), async (c) => {
  const user = getUser(c)
  
  const created = await db
    .insert(runs)
    .values({
      userId: user.sub,
      status: 'active',
      startTime: new Date(),
    })
    .returning()
  
  return c.json(created[0], 201)
})

// Add tracking point to a run
app.post('/runs/:id/track', authMiddleware(), async (c) => {
  const user = getUser(c)
  const id = c.req.param('id')
  const body = await c.req.json()
  
  const { latitude, longitude, altitude, speed, accuracy, timestamp } = body
  
  // Verify run exists and belongs to user
  const run = await db.query.runs.findFirst({
    where: eq(runs.id, id),
  })
  
  if (!run) {
    return c.json({ message: 'Run not found' }, 404)
  }
  
  if (run.userId !== user.sub) {
    return c.json({ message: 'Forbidden' }, 403)
  }
  
  if (run.status === 'completed') {
    return c.json({ message: 'Run already completed' }, 400)
  }
  
  // Add tracking point
  const point = await db
    .insert(runTrackingPoints)
    .values({
      runId: id,
      latitude,
      longitude,
      altitude,
      speed,
      accuracy,
      timestamp: new Date(timestamp),
    })
    .returning()
  
  return c.json(point[0], 201)
})

// Pause a run
app.post('/runs/:id/pause', authMiddleware(), async (c) => {
  const user = getUser(c)
  const id = c.req.param('id')
  
  const run = await db.query.runs.findFirst({
    where: eq(runs.id, id),
  })
  
  if (!run) {
    return c.json({ message: 'Run not found' }, 404)
  }
  
  if (run.userId !== user.sub) {
    return c.json({ message: 'Forbidden' }, 403)
  }
  
  if (run.status !== 'active') {
    return c.json({ message: 'Run is not active' }, 400)
  }
  
  const updated = await db
    .update(runs)
    .set({ status: 'paused' })
    .where(eq(runs.id, id))
    .returning()
  
  return c.json(updated[0])
})

// Resume a run
app.post('/runs/:id/resume', authMiddleware(), async (c) => {
  const user = getUser(c)
  const id = c.req.param('id')
  
  const run = await db.query.runs.findFirst({
    where: eq(runs.id, id),
  })
  
  if (!run) {
    return c.json({ message: 'Run not found' }, 404)
  }
  
  if (run.userId !== user.sub) {
    return c.json({ message: 'Forbidden' }, 403)
  }
  
  if (run.status !== 'paused') {
    return c.json({ message: 'Run is not paused' }, 400)
  }
  
  const updated = await db
    .update(runs)
    .set({ status: 'active' })
    .where(eq(runs.id, id))
    .returning()
  
  return c.json(updated[0])
})

// Complete a run and calculate totals
app.post('/runs/:id/complete', authMiddleware(), async (c) => {
  const user = getUser(c)
  const id = c.req.param('id')
  
  const run = await db.query.runs.findFirst({
    where: eq(runs.id, id),
  })
  
  if (!run) {
    return c.json({ message: 'Run not found' }, 404)
  }
  
  if (run.userId !== user.sub) {
    return c.json({ message: 'Forbidden' }, 403)
  }
  
  if (run.status === 'completed') {
    return c.json({ message: 'Run already completed' }, 400)
  }
  
  // Get user profile for weight-based calorie calculation
  const userProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, user.sub),
  })
  
  // Get all tracking points
  const points = await db.query.runTrackingPoints.findMany({
    where: eq(runTrackingPoints.runId, id),
    orderBy: [runTrackingPoints.timestamp],
  })
  
  // Calculate distance using Haversine formula (0 if no points)
  let totalDistance = 0
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    totalDistance += calculateDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    )
  }
  
  // Calculate duration (in seconds)
  const startTime = new Date(run.startTime)
  const endTime = new Date()
  const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
  
  // Calculate pace (min/km) and average speed (km/h)
  const distanceInKm = totalDistance / 1000
  const durationInHours = duration / 3600
  const durationInMinutes = duration / 60
  
  const pace = distanceInKm > 0 ? durationInMinutes / distanceInKm : 0
  const avgSpeed = durationInHours > 0 ? distanceInKm / durationInHours : 0
  
  // Calculate calories using MET formula
  // Running MET varies by speed: ~8-12 METs for running
  // Formula: Calories = MET × weight(kg) × time(hours)
  // Using speed-based MET estimation
  let met = 8 // default MET for light running
  if (avgSpeed >= 16) met = 16 // very fast running (< 6 min/km)
  else if (avgSpeed >= 13) met = 13.5 // fast running (~7 min/km)
  else if (avgSpeed >= 11) met = 11.5 // moderate running (~8 min/km)
  else if (avgSpeed >= 9.5) met = 10 // jogging (~9 min/km)
  else if (avgSpeed >= 8) met = 8.5 // slow jogging
  else if (avgSpeed >= 6) met = 6 // brisk walking
  else met = 3.5 // walking
  
  // Use user's weight if available, otherwise assume 70kg
  const weightKg = userProfile?.weight ? parseFloat(userProfile.weight) : 70
  const calories = Math.round(met * weightKg * durationInHours)
  
  // Update run with calculated values
  const updated = await db
    .update(runs)
    .set({
      status: 'completed',
      distance: totalDistance.toFixed(2),
      duration,
      pace: pace.toFixed(2),
      avgSpeed: avgSpeed.toFixed(2),
      calories,
      endTime,
    })
    .where(eq(runs.id, id))
    .returning()
  
  return c.json(updated[0])
})

// Helper function: Calculate distance between two GPS points (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

// Delete/discard a run
app.delete('/runs/:id', authMiddleware(), async (c) => {
  const user = getUser(c)
  const id = c.req.param('id')
  
  const run = await db.query.runs.findFirst({
    where: eq(runs.id, id),
  })
  
  if (!run) {
    return c.json({ message: 'Run not found' }, 404)
  }
  
  if (run.userId !== user.sub) {
    return c.json({ message: 'Forbidden' }, 403)
  }
  
  // Delete the run (tracking points are deleted via cascade)
  await db.delete(runs).where(eq(runs.id, id))
  
  return c.json({ message: 'Run deleted' }, 200)
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
  
  // Get tracking points if requested
  const includePoints = c.req.query('includePoints') === 'true'
  
  if (includePoints) {
    const points = await db.query.runTrackingPoints.findMany({
      where: eq(runTrackingPoints.runId, id),
      orderBy: [runTrackingPoints.timestamp],
    })
    
    return c.json({ ...run, trackingPoints: points })
  }
  
  return c.json(run)
})

// Get active run for user (if any)
app.get('/runs/active/current', authMiddleware(), async (c) => {
  const user = getUser(c)
  
  const activeRun = await db.query.runs.findFirst({
    where: and(
      eq(runs.userId, user.sub),
      sql`${runs.status} IN ('active', 'paused')`
    ),
    orderBy: [desc(runs.startTime)],
  })
  
  if (!activeRun) {
    return c.json({ message: 'No active run' }, 404)
  }
  
  return c.json(activeRun)
})

const port = process.env.PORT ? parseInt(process.env.PORT) : 4002

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`Activity service is running on http://localhost:${info.port}`)
})

