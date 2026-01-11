import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { metricsHandler, metricsMiddleware } from "@repo/metrics";
import { config } from "./config.js";
import { authMiddleware, getUser } from "./middleware/auth.js";
import { db } from "./db/index.js";
import { runs } from "./db/schema.js";
import { inArray, sql, and, gte, lte } from "drizzle-orm";
import {
  initRabbitMQ,
  isConnected as isRabbitMQConnected,
} from "./rabbitmq.js";
import {
  initGrpcClients,
  getClubMembers,
  getUserProfiles,
} from "./grpc-client.js";

// Helper function to get run stats from local database
async function getLocalRunStats(
  userIds: string[],
  startDate: string,
  endDate?: string
) {
  if (userIds.length === 0) {
    return [];
  }

  const conditions = [inArray(runs.userId, userIds)];

  if (startDate) {
    conditions.push(gte(runs.startTime, new Date(startDate)));
  }

  if (endDate) {
    conditions.push(lte(runs.startTime, new Date(endDate)));
  }

  const result = await db
    .select({
      user_id: runs.userId,
      total_distance: sql<number>`COALESCE(SUM(CAST(${runs.distance} AS NUMERIC)), 0)`,
      total_duration: sql<number>`COALESCE(SUM(${runs.duration}), 0)`,
    })
    .from(runs)
    .where(and(...conditions))
    .groupBy(runs.userId);

  return result.map((row) => ({
    user_id: row.user_id,
    total_distance: Number(row.total_distance),
    total_duration: Number(row.total_duration),
  }));
}

const app = new Hono();

// Initialize gRPC clients
initGrpcClients(config.activityGrpcUrl, config.clubsGrpcUrl);

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

  // Check database connectivity
  try {
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database timeout")), config.readinessTimeoutMs)
      ),
    ]);
    checks.push({ name: "database", status: "ok" });
  } catch (err) {
    checks.push({
      name: "database",
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

  // Check gRPC connections by making simple test calls
  try {
    await Promise.race([
      getClubMembers("00000000-0000-0000-0000-000000000000"), // Use a valid UUID format
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("gRPC timeout")), config.readinessTimeoutMs)
      ),
    ]);
    checks.push({ name: "clubs_grpc", status: "ok" });
  } catch (err) {
    // Only report error if it's a connection error, not a "not found" error
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    if (errorMsg.includes("UNAVAILABLE") || errorMsg.includes("timeout") || errorMsg.includes("ECONNREFUSED")) {
      checks.push({
        name: "clubs_grpc",
        status: "error",
        error: errorMsg,
      });
    } else {
      // Service is reachable, just returned an expected error (like "not found")
      checks.push({ name: "clubs_grpc", status: "ok" });
    }
  }

  const allHealthy = checks.every((check) => check.status === "ok");
  return c.json({ ready: allHealthy, checks }, allHealthy ? 200 : 503);
});

// Get weekly leaderboard for a club
app.get("/club/:clubId/weekly", authMiddleware(), async (c) => {
  const user = getUser(c);
  const clubId = c.req.param("clubId");

  // Get club members via gRPC
  const memberUserIds = await getClubMembers(clubId);

  // Check if user is a member
  if (!memberUserIds.includes(user.sub)) {
    return c.json({ message: "Not a member of this club" }, 403);
  }

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

  // Get run stats from local database
  const stats = await getLocalRunStats(memberUserIds, weekStart.toISOString());

  // Get user profiles
  const profiles = await getUserProfiles(memberUserIds);
  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));

  // Format distance leaderboard
  const distanceLeaderboard = stats
    .sort((a, b) => b.total_distance - a.total_distance)
    .map((stat, index) => {
      const profile = profileMap.get(stat.user_id);
      return {
        position: index + 1,
        userId: stat.user_id,
        userName: profile?.name || "Unknown",
        userImage: profile?.image || null,
        value: stat.total_distance / 1000, // Convert to km
        unit: "km",
        isCurrentUser: stat.user_id === user.sub,
      };
    });

  // Format active time leaderboard (sorted by duration)
  const timeLeaderboard = [...stats]
    .sort((a, b) => b.total_duration - a.total_duration)
    .map((stat, index) => {
      const profile = profileMap.get(stat.user_id);
      return {
        position: index + 1,
        userId: stat.user_id,
        userName: profile?.name || "Unknown",
        userImage: profile?.image || null,
        value: stat.total_duration / 3600, // Convert to hours
        unit: "hrs",
        isCurrentUser: stat.user_id === user.sub,
      };
    });

  return c.json({
    distance: distanceLeaderboard,
    activeTime: timeLeaderboard,
  });
});

// Get last week's leaderboard for a club
app.get("/club/:clubId/last-week", authMiddleware(), async (c) => {
  const user = getUser(c);
  const clubId = c.req.param("clubId");

  // Get club members via gRPC
  const memberUserIds = await getClubMembers(clubId);

  // Check if user is a member
  if (!memberUserIds.includes(user.sub)) {
    return c.json({ message: "Not a member of this club" }, 403);
  }

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

  // Get run stats from local database
  const stats = await getLocalRunStats(
    memberUserIds,
    lastWeekStart.toISOString(),
    thisWeekStart.toISOString()
  );

  // Get user profiles
  const profiles = await getUserProfiles(memberUserIds);
  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));

  const distanceLeaderboard = stats
    .sort((a, b) => b.total_distance - a.total_distance)
    .map((stat, index) => {
      const profile = profileMap.get(stat.user_id);
      return {
        position: index + 1,
        userId: stat.user_id,
        userName: profile?.name || "Unknown",
        userImage: profile?.image || null,
        value: stat.total_distance / 1000,
        unit: "km",
        isCurrentUser: stat.user_id === user.sub,
      };
    });

  const timeLeaderboard = [...stats]
    .sort((a, b) => b.total_duration - a.total_duration)
    .map((stat, index) => {
      const profile = profileMap.get(stat.user_id);
      return {
        position: index + 1,
        userId: stat.user_id,
        userName: profile?.name || "Unknown",
        userImage: profile?.image || null,
        value: stat.total_duration / 3600,
        unit: "hrs",
        isCurrentUser: stat.user_id === user.sub,
      };
    });

  return c.json({
    distance: distanceLeaderboard,
    activeTime: timeLeaderboard,
  });
});

// Get monthly leaderboard for a club
app.get("/club/:clubId/monthly", authMiddleware(), async (c) => {
  const user = getUser(c);
  const clubId = c.req.param("clubId");

  // Get club members via gRPC
  const memberUserIds = await getClubMembers(clubId);

  // Check if user is a member
  if (!memberUserIds.includes(user.sub)) {
    return c.json({ message: "Not a member of this club" }, 403);
  }

  if (memberUserIds.length === 0) {
    return c.json({ distance: [], activeTime: [] });
  }

  // Calculate start of current month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get run stats from local database
  const stats = await getLocalRunStats(memberUserIds, monthStart.toISOString());

  // Get user profiles
  const profiles = await getUserProfiles(memberUserIds);
  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));

  const distanceLeaderboard = stats
    .sort((a, b) => b.total_distance - a.total_distance)
    .map((stat, index) => {
      const profile = profileMap.get(stat.user_id);
      return {
        position: index + 1,
        userId: stat.user_id,
        userName: profile?.name || "Unknown",
        userImage: profile?.image || null,
        value: stat.total_distance / 1000,
        unit: "km",
        isCurrentUser: stat.user_id === user.sub,
      };
    });

  const timeLeaderboard = [...stats]
    .sort((a, b) => b.total_duration - a.total_duration)
    .map((stat, index) => {
      const profile = profileMap.get(stat.user_id);
      return {
        position: index + 1,
        userId: stat.user_id,
        userName: profile?.name || "Unknown",
        userImage: profile?.image || null,
        value: stat.total_duration / 3600,
        unit: "hrs",
        isCurrentUser: stat.user_id === user.sub,
      };
    });

  return c.json({
    distance: distanceLeaderboard,
    activeTime: timeLeaderboard,
  });
});

// Initialize RabbitMQ consumer in background
initRabbitMQ();

serve(
  {
    fetch: app.fetch,
    port: config.port,
    hostname: '0.0.0.0',
  },
  (info) => {
    console.log(`🚀 Leaderboards service is running on http://localhost:${info.port}`);
  }
);
