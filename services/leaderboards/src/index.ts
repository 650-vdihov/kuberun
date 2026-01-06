import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { metricsHandler, metricsMiddleware } from "@repo/metrics";
import { config } from "./config.js";
import { authMiddleware, getUser } from "./middleware/auth.js";
import { activityDb, clubsDb } from "./db/index.js";
import { sql } from "drizzle-orm";
import {
  startConsuming,
  isConnected as isRabbitMQConnected,
} from "./rabbitmq.js";

const app = new Hono();

app.use("*", metricsMiddleware());
app.use("*", logger());
app.use(
  "/*",
  cors({
    origin: config.trustedOrigins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/", (c) => {
  return c.text("Leaderboards Service");
});

app.get("/metrics", metricsHandler);

app.get("/health", (c) => {
  return c.json({ status: "ok", service: "leaderboards" }, 200);
});

// Readiness check
app.get("/ready", async (c) => {
  const checks: { name: string; status: "ok" | "error"; error?: string }[] = [];

  // Check activity database
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Database timeout")),
        config.readinessTimeoutMs
      )
    );
    const dbPromise = activityDb.execute(sql`SELECT 1`);

    await Promise.race([dbPromise, timeoutPromise]);
    checks.push({ name: "activity_database", status: "ok" });
  } catch (err) {
    checks.push({
      name: "activity_database",
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }

  // Check clubs database
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Database timeout")),
        config.readinessTimeoutMs
      )
    );
    const dbPromise = clubsDb.execute(sql`SELECT 1`);

    await Promise.race([dbPromise, timeoutPromise]);
    checks.push({ name: "clubs_database", status: "ok" });
  } catch (err) {
    checks.push({
      name: "clubs_database",
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }

  // Check RabbitMQ
  if (isRabbitMQConnected()) {
    checks.push({ name: "rabbitmq", status: "ok" });
  } else {
    checks.push({ name: "rabbitmq", status: "error", error: "Not connected" });
  }

  const allHealthy = checks.every((check) => check.status === "ok");
  return c.json({ ready: allHealthy, checks }, allHealthy ? 200 : 503);
});

// Get weekly leaderboard for a club
app.get("/club/:clubId/weekly", authMiddleware(), async (c) => {
  const user = getUser(c);
  const clubId = c.req.param("clubId");

  // Check if user is a member of this club
  const membership: any[] = await clubsDb.execute(
    sql`SELECT * FROM club_members WHERE club_id = ${clubId} AND user_id = ${user.sub} LIMIT 1`
  );

  if (membership.length === 0) {
    return c.json({ message: "Not a member of this club" }, 403);
  }

  // Get all club members
  const members: any[] = await clubsDb.execute(
    sql`SELECT user_id FROM club_members WHERE club_id = ${clubId}`
  );

  const memberUserIds = members.map((row: any) => row.user_id);

  if (memberUserIds.length === 0) {
    return c.json({ distance: [], activeTime: [] });
  }

  // Calculate start of current week (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  // Get runs for this week for all members
  const runs: any[] = await activityDb.execute(
    sql`
      SELECT 
        user_id,
        SUM(COALESCE(CAST(distance AS NUMERIC), 0)) as total_distance,
        SUM(COALESCE(duration, 0)) as total_duration
      FROM runs
      WHERE user_id = ANY(${sql.raw(`ARRAY[${memberUserIds.map(id => `'${id}'`).join(',')}]`)})
        AND status = 'completed'
        AND start_time >= ${weekStart.toISOString()}
      GROUP BY user_id
      ORDER BY total_distance DESC
    `
  );

  // Format distance leaderboard
  const distanceLeaderboard = runs.map((row: any, index: number) => ({
    position: index + 1,
    userId: row.user_id,
    value: parseFloat(row.total_distance) / 1000, // Convert to km
    unit: "km",
    isCurrentUser: row.user_id === user.sub,
  }));

  // Format active time leaderboard (sorted by duration)
  const timeLeaderboard = [...runs]
    .sort((a: any, b: any) => parseInt(b.total_duration) - parseInt(a.total_duration))
    .map((row: any, index: number) => ({
      position: index + 1,
      userId: row.user_id,
      value: parseFloat(row.total_duration) / 3600, // Convert to hours
      unit: "hrs",
      isCurrentUser: row.user_id === user.sub,
    }));

  return c.json({
    distance: distanceLeaderboard,
    activeTime: timeLeaderboard,
  });
});

// Get last week's leaderboard for a club
app.get("/club/:clubId/last-week", authMiddleware(), async (c) => {
  const user = getUser(c);
  const clubId = c.req.param("clubId");

  // Check if user is a member
  const membership = await clubsDb.execute(
    sql`SELECT * FROM club_members WHERE club_id = ${clubId} AND user_id = ${user.sub} LIMIT 1`
  );

  if (membership.length === 0) {
    return c.json({ message: "Not a member of this club" }, 403);
  }

  // Get all club members
  const members = await clubsDb.execute(
    sql`SELECT user_id FROM club_members WHERE club_id = ${clubId}`
  );

  const memberUserIds = members.map((row: any) => row.user_id);

  if (memberUserIds.length === 0) {
    return c.json({ distance: [], activeTime: [] });
  }

  // Calculate last week's date range
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() + diffToMonday);
  thisWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);

  // Get runs for last week
  const runs: any[] = await activityDb.execute(
    sql`
      SELECT 
        user_id,
        SUM(COALESCE(CAST(distance AS NUMERIC), 0)) as total_distance,
        SUM(COALESCE(duration, 0)) as total_duration
      FROM runs
      WHERE user_id = ANY(${sql.raw(`ARRAY[${memberUserIds.map(id => `'${id}'`).join(',')}]`)})
        AND status = 'completed'
        AND start_time >= ${lastWeekStart.toISOString()}
        AND start_time < ${thisWeekStart.toISOString()}
      GROUP BY user_id
      ORDER BY total_distance DESC
    `
  );

  const distanceLeaderboard = runs.map((row: any, index: number) => ({
    position: index + 1,
    userId: row.user_id,
    value: parseFloat(row.total_distance) / 1000,
    unit: "km",
    isCurrentUser: row.user_id === user.sub,
  }));

  const timeLeaderboard = [...runs]
    .sort((a: any, b: any) => parseInt(b.total_duration) - parseInt(a.total_duration))
    .map((row: any, index: number) => ({
      position: index + 1,
      userId: row.user_id,
      value: parseFloat(row.total_duration) / 3600,
      unit: "hrs",
      isCurrentUser: row.user_id === user.sub,
    }));

  return c.json({
    distance: distanceLeaderboard,
    activeTime: timeLeaderboard,
  });
});

// Get monthly leaderboard for a club
app.get("/club/:clubId/monthly", authMiddleware(), async (c) => {
  const user = getUser(c);
  const clubId = c.req.param("clubId");

  // Check if user is a member
  const membership = await clubsDb.execute(
    sql`SELECT * FROM club_members WHERE club_id = ${clubId} AND user_id = ${user.sub} LIMIT 1`
  );

  if (membership.length === 0) {
    return c.json({ message: "Not a member of this club" }, 403);
  }

  // Get all club members
  const members = await clubsDb.execute(
    sql`SELECT user_id FROM club_members WHERE club_id = ${clubId}`
  );

  const memberUserIds = members.map((row: any) => row.user_id);

  if (memberUserIds.length === 0) {
    return c.json({ distance: [], activeTime: [] });
  }

  // Calculate start of current month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get runs for this month
  const runs: any[] = await activityDb.execute(
    sql`
      SELECT 
        user_id,
        SUM(COALESCE(CAST(distance AS NUMERIC), 0)) as total_distance,
        SUM(COALESCE(duration, 0)) as total_duration
      FROM runs
      WHERE user_id = ANY(${sql.raw(`ARRAY[${memberUserIds.map(id => `'${id}'`).join(',')}]`)})
        AND status = 'completed'
        AND start_time >= ${monthStart.toISOString()}
      GROUP BY user_id
      ORDER BY total_distance DESC
    `
  );

  const distanceLeaderboard = runs.map((row: any, index: number) => ({
    position: index + 1,
    userId: row.user_id,
    value: parseFloat(row.total_distance) / 1000,
    unit: "km",
    isCurrentUser: row.user_id === user.sub,
  }));

  const timeLeaderboard = [...runs]
    .sort((a: any, b: any) => parseInt(b.total_duration) - parseInt(a.total_duration))
    .map((row: any, index: number) => ({
      position: index + 1,
      userId: row.user_id,
      value: parseFloat(row.total_duration) / 3600,
      unit: "hrs",
      isCurrentUser: row.user_id === user.sub,
    }));

  return c.json({
    distance: distanceLeaderboard,
    activeTime: timeLeaderboard,
  });
});

// Start RabbitMQ consumer in background
startConsuming();

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`🚀 Leaderboards service is running on http://localhost:${info.port}`);
  }
);
