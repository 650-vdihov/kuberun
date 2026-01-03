import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { metricsHandler, metricsMiddleware } from "@repo/metrics";
import { config } from "./config.js";
import { auth } from "./auth.js";
import { db } from "./db/index.js";
import { sql } from "drizzle-orm";

const app = new Hono();

// Middleware
app.use("*", metricsMiddleware());
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: config.trustedOrigins,
    credentials: true,
  })
);

// Health check endpoint
app.get("/", (c) => {
  return c.json({ status: "ok", service: "auth" });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

// Readiness check - verify dependencies are ready
app.get("/ready", async (c) => {
  const checks: { name: string; status: "ok" | "error"; error?: string }[] = [];

  // Check database connectivity with timeout
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Database timeout")),
        config.readinessTimeoutMs
      )
    );
    const dbPromise = db.execute(sql`SELECT 1`);

    await Promise.race([dbPromise, timeoutPromise]);
    checks.push({ name: "database", status: "ok" });
  } catch (err) {
    checks.push({
      name: "database",
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }

  const allHealthy = checks.every((check) => check.status === "ok");

  return c.json({ ready: allHealthy, checks }, allHealthy ? 200 : 503);
});

app.get("/metrics", metricsHandler);

// Mount better-auth handler on /api/auth/*
app.on(["POST", "GET"], "/api/auth/**", (c) => {
  return auth.handler(c.req.raw);
});

// JWKS endpoint for microservices to fetch public keys for JWT validation
// Services should cache this and refresh periodically
app.get("/.well-known/jwks.json", async (c) => {
  const response = await auth.handler(
    new Request(new URL("/api/auth/jwks", c.req.url).toString())
  );
  return response;
});

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`🚀 Auth service is running on http://localhost:${info.port}`);
  }
);
